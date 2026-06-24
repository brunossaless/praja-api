import { Injectable, Logger } from '@nestjs/common';
import {
  BudgetStatus,
  BudgetType,
  Payment,
  PaymentKind,
  PaymentMethodType,
  PaymentPurpose,
  PaymentStatus,
  Prisma,
  ScheduleStatus,
} from '@prisma/client';
import { AppException } from 'src/common/errors/app.exception';
import { ErrorCode } from 'src/common/errors/error-codes';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentGateway } from './payment-gateway';
import { serializePayment } from './payment.serializer';
import { CreateCheckoutDto, CreateVisitCheckoutDto } from './payments.dto';
import { VISIT_FEE_CENTS } from './visit-fee';
import { WebhookInput } from './webhook.dto';

const NON_TERMINAL: PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.PROCESSING,
];

const TERMINAL_STATUSES: PaymentStatus[] = [
  PaymentStatus.PAID,
  PaymentStatus.FAILED,
  PaymentStatus.CANCELED,
  PaymentStatus.REFUNDED,
];

interface ChargeContext {
  amountCents: number;
  currency: string;
  description: string;
  payerEmail: string;
}

/** What a payment is for: a budget (service) or a schedule (visit fee). */
interface PaymentTarget {
  purpose: PaymentPurpose;
  kind: PaymentKind;
  budgetId: number | null;
  scheduleId: number | null;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGateway,
  ) {}

  /**
   * Creates a checkout for an ACCEPTED budget (the service payment). Only the
   * budget's client can pay. The amount always comes from `budget.totalCents`.
   */
  async createCheckout(dto: CreateCheckoutDto, clientUserId: number) {
    const budget = await this.prisma.budget.findUnique({
      where: { id: dto.budgetId },
      include: { client: { select: { email: true } } },
    });
    if (!budget) {
      throw new AppException(
        ErrorCode.BUDGET_NOT_FOUND,
        'Orçamento não encontrado.',
      );
    }

    if (budget.clientId !== clientUserId) {
      throw new AppException(
        ErrorCode.BUDGET_FORBIDDEN,
        'Apenas o cliente do orçamento pode efetuar o pagamento.',
      );
    }

    if (budget.status === BudgetStatus.PAID) {
      throw new AppException(
        ErrorCode.PAYMENT_INVALID_STATE,
        'Este orçamento já foi pago.',
      );
    }

    if (budget.status !== BudgetStatus.ACCEPTED) {
      throw new AppException(
        ErrorCode.PAYMENT_BUDGET_NOT_ACCEPTED,
        'O orçamento precisa ser aceito antes do pagamento.',
        { status: budget.status },
      );
    }

    this.assertKindMatchesBudget(dto.kind, budget.type);
    await this.assertNotAlreadyPaid({ budgetId: budget.id });

    const target: PaymentTarget = {
      purpose: PaymentPurpose.BUDGET,
      kind: dto.kind,
      budgetId: budget.id,
      scheduleId: null,
    };
    const ctx: ChargeContext = {
      amountCents: budget.totalCents,
      currency: budget.currency,
      description: budget.title,
      payerEmail: budget.client.email,
    };

    return this.charge(target, dto.method, dto.card ?? null, ctx);
  }

  /**
   * Creates a checkout for the fixed visit fee, paid by the schedule's client
   * to confirm the visit. Allowed only after the schedule is ACCEPTED and
   * before any budget. The amount is server-defined (VISIT_FEE_CENTS).
   */
  async createVisitCheckout(dto: CreateVisitCheckoutDto, clientUserId: number) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: dto.scheduleId },
      include: { requester: { select: { email: true } } },
    });
    if (!schedule) {
      throw new AppException(
        ErrorCode.SCHEDULE_NOT_FOUND,
        'Agendamento não encontrado.',
      );
    }

    if (schedule.requesterId !== clientUserId) {
      throw new AppException(
        ErrorCode.SCHEDULE_FORBIDDEN,
        'Apenas o cliente do agendamento pode pagar a visita.',
      );
    }

    if (schedule.status !== ScheduleStatus.ACCEPTED) {
      throw new AppException(
        ErrorCode.SCHEDULE_INVALID_STATE,
        'A visita só pode ser paga após o agendamento ser aceito.',
        { status: schedule.status },
      );
    }

    await this.assertNotAlreadyPaid({
      scheduleId: schedule.id,
      purpose: PaymentPurpose.VISIT_FEE,
    });

    const target: PaymentTarget = {
      purpose: PaymentPurpose.VISIT_FEE,
      kind: PaymentKind.ONE_TIME,
      budgetId: null,
      scheduleId: schedule.id,
    };
    const ctx: ChargeContext = {
      amountCents: VISIT_FEE_CENTS,
      currency: 'BRL',
      description: 'Taxa de visita',
      payerEmail: schedule.requester.email,
    };

    return this.charge(target, dto.method, dto.card ?? null, ctx);
  }

  /** Status endpoint polled by the app while a charge is PENDING. */
  async findById(paymentId: number, userId: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        budget: { select: { clientId: true, workerId: true } },
        schedule: {
          select: { requesterId: true, job: { select: { userId: true } } },
        },
      },
    });
    if (!payment) {
      throw new AppException(
        ErrorCode.PAYMENT_NOT_FOUND,
        'Pagamento não encontrado.',
      );
    }

    if (!this.isParticipant(payment, userId)) {
      throw new AppException(
        ErrorCode.BUDGET_FORBIDDEN,
        'Você não tem acesso a este pagamento.',
      );
    }

    const fresh = await this.refreshIfPending(payment);
    return serializePayment(fresh);
  }

  /**
   * Processes a Mercado Pago webhook. Validates the signature, fetches the
   * current payment status from the provider and applies it idempotently,
   * settling the budget on PAID (visit payments have no budget to settle).
   */
  async handleWebhook(input: WebhookInput) {
    if (
      !this.gateway.verifyWebhookSignature({
        xSignature: input.xSignature,
        xRequestId: input.xRequestId,
        dataId: input.dataId,
      })
    ) {
      throw new AppException(
        ErrorCode.UNAUTHORIZED,
        'Assinatura do webhook inválida.',
      );
    }

    if (input.type && input.type !== 'payment') return { received: true };
    if (!input.dataId) return { received: true };

    const payment = await this.prisma.payment.findFirst({
      where: { providerPaymentId: input.dataId },
    });
    if (!payment) {
      this.logger.warn(`Webhook for unknown payment ${input.dataId}`);
      return { received: true };
    }

    const status = await this.withGateway(() =>
      this.gateway.getPaymentStatus(input.dataId!),
    );
    if (status) await this.applyStatus(payment, status);
    return { received: true };
  }

  // --- internals -----------------------------------------------------------

  private charge(
    target: PaymentTarget,
    method: PaymentMethodType,
    card: CreateCheckoutDto['card'],
    ctx: ChargeContext,
  ) {
    if (method === PaymentMethodType.PIX) {
      return this.createPixPayment(target, ctx);
    }
    return this.createCardPayment(target, card, ctx);
  }

  private async createPixPayment(target: PaymentTarget, ctx: ChargeContext) {
    // Reuse a still-valid PENDING PIX charge instead of generating a new one.
    const existing = await this.prisma.payment.findFirst({
      where: {
        ...this.targetWhere(target),
        method: PaymentMethodType.PIX,
        status: PaymentStatus.PENDING,
        pixExpiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return serializePayment(existing);

    const charge = await this.withGateway(() =>
      this.gateway.createPixCharge({
        amountCents: ctx.amountCents,
        description: ctx.description,
        payerEmail: ctx.payerEmail,
      }),
    );

    const payment = await this.prisma.payment.create({
      data: {
        ...this.targetData(target),
        method: PaymentMethodType.PIX,
        status: PaymentStatus.PENDING,
        amountCents: ctx.amountCents,
        currency: ctx.currency,
        provider: this.gateway.provider,
        providerPaymentId: charge.providerPaymentId,
        pixQrCodeText: charge.qrCodeText,
        pixQrCodeBase64: charge.qrCodeBase64,
        pixExpiresAt: charge.expiresAt,
      },
    });

    return serializePayment(payment);
  }

  private async createCardPayment(
    target: PaymentTarget,
    card: CreateCheckoutDto['card'],
    ctx: ChargeContext,
  ) {
    if (!card) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Os dados do cartão são obrigatórios.',
      );
    }

    const result = await this.withGateway(() =>
      this.gateway.chargeCard({
        amountCents: ctx.amountCents,
        description: ctx.description,
        payerEmail: ctx.payerEmail,
        installments: card.installments,
        card,
      }),
    );

    const payment = await this.prisma.payment.create({
      data: {
        ...this.targetData(target),
        method: PaymentMethodType.CREDIT_CARD,
        status: result.status,
        amountCents: ctx.amountCents,
        currency: ctx.currency,
        provider: this.gateway.provider,
        providerPaymentId: result.providerPaymentId,
        installments: card.installments,
      },
    });

    // Card capture is synchronous: settle the budget immediately on success.
    if (
      result.status === PaymentStatus.PAID &&
      target.purpose === PaymentPurpose.BUDGET &&
      target.budgetId
    ) {
      await this.markBudgetPaid(target.budgetId, target.kind);
    }

    return serializePayment(payment);
  }

  /** When polling a non-terminal payment, sync its status from the provider. */
  private async refreshIfPending(payment: Payment): Promise<Payment> {
    if (!payment.providerPaymentId || !NON_TERMINAL.includes(payment.status)) {
      return payment;
    }
    let status: PaymentStatus | null;
    try {
      status = await this.gateway.getPaymentStatus(payment.providerPaymentId);
    } catch {
      this.logger.warn(`Status refresh failed for payment ${payment.id}`);
      return payment;
    }
    if (!status || status === payment.status) return payment;

    await this.applyStatus(payment, status);
    return { ...payment, status };
  }

  /** Applies a status transition idempotently and settles the budget on PAID. */
  private async applyStatus(payment: Payment, newStatus: PaymentStatus) {
    if (payment.status === newStatus) return; // already applied

    const isForward =
      !TERMINAL_STATUSES.includes(payment.status) ||
      (payment.status === PaymentStatus.PAID &&
        newStatus === PaymentStatus.REFUNDED);
    if (!isForward) {
      this.logger.warn(
        `Ignoring webhook ${payment.status} -> ${newStatus} for payment ${payment.id}`,
      );
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: newStatus },
    });

    if (
      newStatus === PaymentStatus.PAID &&
      payment.purpose === PaymentPurpose.BUDGET &&
      payment.budgetId
    ) {
      await this.markBudgetPaid(payment.budgetId, payment.kind);
    }
  }

  private async markBudgetPaid(budgetId: number, kind: PaymentKind) {
    await this.prisma.budget.update({
      where: { id: budgetId },
      data: { status: BudgetStatus.PAID },
    });
    if (kind === PaymentKind.SUBSCRIPTION) {
      // Hook point: activate the recurring worker subscription (MP preapproval).
      this.logger.log(`Subscription activated for budget ${budgetId}`);
    }
  }

  private assertKindMatchesBudget(kind: PaymentKind, type: BudgetType) {
    const expected =
      type === BudgetType.RECURRING
        ? PaymentKind.SUBSCRIPTION
        : PaymentKind.ONE_TIME;
    if (kind !== expected) {
      throw new AppException(
        ErrorCode.PAYMENT_INVALID_STATE,
        'O tipo de pagamento não corresponde ao tipo do orçamento.',
        { budgetType: type, expectedKind: expected, receivedKind: kind },
      );
    }
  }

  /** Idempotency guard: never double-charge a target already settled. */
  private async assertNotAlreadyPaid(where: Prisma.PaymentWhereInput) {
    const paid = await this.prisma.payment.findFirst({
      where: { ...where, status: PaymentStatus.PAID },
    });
    if (paid) {
      throw new AppException(
        ErrorCode.PAYMENT_INVALID_STATE,
        'Esta cobrança já foi paga.',
      );
    }
  }

  private isParticipant(
    payment: {
      budget?: { clientId: number; workerId: number } | null;
      schedule?: { requesterId: number; job: { userId: number } } | null;
    },
    userId: number,
  ): boolean {
    if (payment.budget) {
      return (
        userId === payment.budget.clientId || userId === payment.budget.workerId
      );
    }
    if (payment.schedule) {
      return (
        userId === payment.schedule.requesterId ||
        userId === payment.schedule.job.userId
      );
    }
    return false;
  }

  private targetWhere(target: PaymentTarget): Prisma.PaymentWhereInput {
    return target.budgetId
      ? { budgetId: target.budgetId }
      : { scheduleId: target.scheduleId, purpose: target.purpose };
  }

  private targetData(target: PaymentTarget) {
    return {
      purpose: target.purpose,
      kind: target.kind,
      budgetId: target.budgetId,
      scheduleId: target.scheduleId,
    };
  }

  private async withGateway<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.error('Payment gateway error', error as Error);
      throw new AppException(
        ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE,
        'O provedor de pagamento está indisponível. Tente novamente.',
      );
    }
  }
}

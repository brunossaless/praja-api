import { Injectable } from '@nestjs/common';
import {
  BudgetStatus,
  BudgetType,
  PaymentPurpose,
  PaymentStatus,
  Prisma,
  ScheduleStatus,
} from '@prisma/client';
import { AppException } from 'src/common/errors/app.exception';
import { ErrorCode } from 'src/common/errors/error-codes';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BudgetWithRelations,
  budgetInclude,
  serializeBudget,
} from './budget.serializer';
import { CreateBudgetDto, RespondBudgetDto } from './budgets.dto';

/**
 * A budget already in play for a schedule: another budget cannot be created
 * while one of these exists. REJECTED/CANCELED budgets free the schedule again.
 */
const ACTIVE_BUDGET_STATUSES: BudgetStatus[] = [
  BudgetStatus.DRAFT,
  BudgetStatus.SENT,
  BudgetStatus.ACCEPTED,
  BudgetStatus.PAID,
];

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Provider sends a detailed budget right after the schedule is accepted.
   * Totals are always computed server-side from the items.
   */
  async create(dto: CreateBudgetDto, workerUserId: number) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: dto.scheduleId },
      include: { job: true },
    });

    if (!schedule) {
      throw new AppException(
        ErrorCode.BUDGET_NOT_FOUND,
        'Agendamento não encontrado.',
      );
    }

    if (schedule.job.userId !== workerUserId) {
      throw new AppException(
        ErrorCode.BUDGET_FORBIDDEN,
        'Apenas o prestador responsável pode enviar o orçamento.',
      );
    }

    if (schedule.status !== ScheduleStatus.ACCEPTED) {
      throw new AppException(
        ErrorCode.BUDGET_INVALID_STATE,
        'O orçamento só pode ser criado após o agendamento ser aceito.',
        { scheduleStatus: schedule.status },
      );
    }

    // The client must pay the visit fee before the provider sends a budget.
    const visitPaid = await this.prisma.payment.findFirst({
      where: {
        scheduleId: schedule.id,
        purpose: PaymentPurpose.VISIT_FEE,
        status: PaymentStatus.PAID,
      },
    });
    if (!visitPaid) {
      throw new AppException(
        ErrorCode.VISIT_FEE_REQUIRED,
        'A taxa de visita precisa ser paga antes do envio do orçamento.',
      );
    }

    const existing = await this.prisma.budget.findFirst({
      where: {
        scheduleId: dto.scheduleId,
        status: { in: ACTIVE_BUDGET_STATUSES },
      },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.BUDGET_INVALID_STATE,
        'Já existe um orçamento ativo para este agendamento.',
        { budgetId: existing.id, status: existing.status },
      );
    }

    const items = dto.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitAmountCents: item.unitAmountCents,
      amountCents: item.quantity * item.unitAmountCents,
    }));
    const subtotalCents = items.reduce(
      (sum, item) => sum + item.amountCents,
      0,
    );

    const recurrenceIntervalMonths =
      dto.type === BudgetType.RECURRING
        ? (dto.recurrenceIntervalMonths ?? 1)
        : null;

    const budget = await this.prisma.budget.create({
      data: {
        scheduleId: schedule.id,
        jobId: schedule.jobId,
        workerId: schedule.job.userId,
        clientId: schedule.requesterId,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        status: BudgetStatus.SENT,
        subtotalCents,
        totalCents: subtotalCents,
        recurrenceIntervalMonths,
        items: { create: items },
      },
      include: budgetInclude,
    });

    return serializeBudget(budget);
  }

  /** Client accepts or rejects a budget that is still in SENT state. */
  async respond(budgetId: number, dto: RespondBudgetDto, clientUserId: number) {
    const budget = await this.requireBudget(budgetId);

    if (budget.clientId !== clientUserId) {
      throw new AppException(
        ErrorCode.BUDGET_FORBIDDEN,
        'Apenas o cliente do orçamento pode respondê-lo.',
      );
    }

    if (budget.status !== BudgetStatus.SENT) {
      throw new AppException(
        ErrorCode.BUDGET_INVALID_STATE,
        'Este orçamento não está mais aguardando resposta.',
        { status: budget.status },
      );
    }

    const updated = await this.prisma.budget.update({
      where: { id: budgetId },
      data: { status: dto.status, clientNote: dto.clientNote ?? null },
      include: budgetInclude,
    });

    return serializeBudget(updated);
  }

  /** Returns a budget by id; only its worker or client may read it. */
  async findById(budgetId: number, userId: number) {
    const budget = await this.requireBudget(budgetId);
    this.assertParticipant(budget, userId);
    return serializeBudget(budget);
  }

  /**
   * Returns the latest budget of a schedule for the requesting participant,
   * or `null` when none exists. Filtering by participant both authorizes the
   * read and avoids leaking other users' budgets.
   */
  async findBySchedule(scheduleId: number, userId: number) {
    const budget = await this.prisma.budget.findFirst({
      where: {
        scheduleId,
        OR: [{ workerId: userId }, { clientId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: budgetInclude,
    });

    return budget ? serializeBudget(budget) : null;
  }

  private async requireBudget(budgetId: number): Promise<BudgetWithRelations> {
    const budget = await this.prisma.budget.findUnique({
      where: { id: budgetId },
      include: budgetInclude,
    });
    if (!budget) {
      throw new AppException(
        ErrorCode.BUDGET_NOT_FOUND,
        'Orçamento não encontrado.',
      );
    }
    return budget;
  }

  private assertParticipant(
    budget: Pick<Prisma.BudgetGetPayload<true>, 'workerId' | 'clientId'>,
    userId: number,
  ) {
    if (budget.workerId !== userId && budget.clientId !== userId) {
      throw new AppException(
        ErrorCode.BUDGET_FORBIDDEN,
        'Você não tem acesso a este orçamento.',
      );
    }
  }
}

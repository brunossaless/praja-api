import {
  BudgetStatus,
  BudgetType,
  PaymentKind,
  PaymentMethodType,
  PaymentStatus,
} from '@prisma/client';
import { AppException } from 'src/common/errors/app.exception';
import { ErrorCode } from 'src/common/errors/error-codes';
import { PaymentsService } from './payments.service';
import { CreateCheckoutDto } from './payments.dto';

const CLIENT_ID = 123;
const WORKER_ID = 9;

function buildMockPrisma() {
  return {
    budget: { findUnique: jest.fn(), update: jest.fn() },
    schedule: { findUnique: jest.fn() },
    payment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

function buildMockGateway() {
  return {
    provider: 'mercadopago',
    createPixCharge: jest.fn(),
    chargeCard: jest.fn(),
    getPaymentStatus: jest.fn(),
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  };
}

function acceptedBudget(overrides = {}) {
  return {
    id: 55,
    clientId: CLIENT_ID,
    workerId: WORKER_ID,
    status: BudgetStatus.ACCEPTED,
    type: BudgetType.ONE_TIME,
    totalCents: 19500,
    currency: 'BRL',
    title: 'Instalação de tomadas',
    client: { email: 'ana@email.com' },
    ...overrides,
  };
}

const goodCard = {
  holderName: 'ANA',
  number: '4235647728025682',
  expMonth: '12',
  expYear: '2030',
  cvv: '123',
  installments: 3,
};

async function expectAppException(promise: Promise<unknown>, code: ErrorCode) {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  await promise.catch((err: AppException) => {
    expect((err.getResponse() as { code: string }).code).toBe(code);
  });
}

describe('PaymentsService', () => {
  let prisma: ReturnType<typeof buildMockPrisma>;
  let gateway: ReturnType<typeof buildMockGateway>;
  let service: PaymentsService;

  beforeEach(() => {
    prisma = buildMockPrisma();
    gateway = buildMockGateway();
    service = new PaymentsService(prisma as never, gateway as never);
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 900,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }),
    );
  });

  it('creates a PENDING PIX payment with a pix block', async () => {
    prisma.budget.findUnique.mockResolvedValue(acceptedBudget());
    gateway.createPixCharge.mockResolvedValue({
      providerPaymentId: 'pix_1',
      qrCodeText: '00020126...BR',
      qrCodeBase64: null,
      ticketUrl: null,
      expiresAt: new Date(Date.now() + 60000),
    });
    const dto: CreateCheckoutDto = {
      budgetId: 55,
      method: PaymentMethodType.PIX,
      kind: PaymentKind.ONE_TIME,
      card: null,
    };

    const result = await service.createCheckout(dto, CLIENT_ID);

    expect(gateway.createPixCharge).toHaveBeenCalledWith({
      amountCents: 19500,
      description: 'Instalação de tomadas',
      payerEmail: 'ana@email.com',
    });
    expect(result.status).toBe(PaymentStatus.PENDING);
    expect(result.pix?.qrCodeText).toBe('00020126...BR');
  });

  it('captures a card payment and settles the budget', async () => {
    prisma.budget.findUnique.mockResolvedValue(acceptedBudget());
    gateway.chargeCard.mockResolvedValue({
      providerPaymentId: 'card_1',
      status: PaymentStatus.PAID,
    });
    const dto: CreateCheckoutDto = {
      budgetId: 55,
      method: PaymentMethodType.CREDIT_CARD,
      kind: PaymentKind.ONE_TIME,
      card: goodCard,
    };

    const result = await service.createCheckout(dto, CLIENT_ID);

    expect(result.status).toBe(PaymentStatus.PAID);
    expect(result.pix).toBeNull();
    expect(prisma.budget.update).toHaveBeenCalledWith({
      where: { id: 55 },
      data: { status: BudgetStatus.PAID },
    });
  });

  it('returns a FAILED payment for a declined card without settling the budget', async () => {
    prisma.budget.findUnique.mockResolvedValue(acceptedBudget());
    gateway.chargeCard.mockResolvedValue({
      providerPaymentId: 'mp_declined_x',
      status: PaymentStatus.FAILED,
    });

    const result = await service.createCheckout(
      {
        budgetId: 55,
        method: PaymentMethodType.CREDIT_CARD,
        kind: PaymentKind.ONE_TIME,
        card: goodCard,
      },
      CLIENT_ID,
    );

    expect(result.status).toBe(PaymentStatus.FAILED);
    expect(prisma.budget.update).not.toHaveBeenCalled();
  });

  it('rejects a kind that does not match the budget type', async () => {
    prisma.budget.findUnique.mockResolvedValue(acceptedBudget());
    await expectAppException(
      service.createCheckout(
        {
          budgetId: 55,
          method: PaymentMethodType.PIX,
          kind: PaymentKind.SUBSCRIPTION,
          card: null,
        },
        CLIENT_ID,
      ),
      ErrorCode.PAYMENT_INVALID_STATE,
    );
  });

  it('rejects checkout when the budget is not accepted', async () => {
    prisma.budget.findUnique.mockResolvedValue(
      acceptedBudget({ status: BudgetStatus.SENT }),
    );
    await expectAppException(
      service.createCheckout(
        {
          budgetId: 55,
          method: PaymentMethodType.PIX,
          kind: PaymentKind.ONE_TIME,
          card: null,
        },
        CLIENT_ID,
      ),
      ErrorCode.PAYMENT_BUDGET_NOT_ACCEPTED,
    );
  });

  it('forbids a non-client from paying', async () => {
    prisma.budget.findUnique.mockResolvedValue(acceptedBudget());
    await expectAppException(
      service.createCheckout(
        {
          budgetId: 55,
          method: PaymentMethodType.PIX,
          kind: PaymentKind.ONE_TIME,
          card: null,
        },
        999,
      ),
      ErrorCode.BUDGET_FORBIDDEN,
    );
  });

  describe('createVisitCheckout', () => {
    const acceptedSchedule = (overrides = {}) => ({
      id: 10,
      requesterId: CLIENT_ID,
      status: 'ACCEPTED',
      requester: { email: 'ana@email.com' },
      ...overrides,
    });

    it('creates a R$25 PIX visit fee tied to the schedule', async () => {
      prisma.schedule.findUnique.mockResolvedValue(acceptedSchedule());
      gateway.createPixCharge.mockResolvedValue({
        providerPaymentId: 'pix_v',
        qrCodeText: 'qr',
        qrCodeBase64: null,
        ticketUrl: null,
        expiresAt: new Date(Date.now() + 60000),
      });

      const result = await service.createVisitCheckout(
        { scheduleId: 10, method: PaymentMethodType.PIX, card: null },
        CLIENT_ID,
      );

      expect(gateway.createPixCharge).toHaveBeenCalledWith({
        amountCents: 2500,
        description: 'Taxa de visita',
        payerEmail: 'ana@email.com',
      });
      // Persisted as a schedule-linked VISIT_FEE payment, no budget.
      const data = prisma.payment.create.mock.calls[0][0].data;
      expect(data.scheduleId).toBe(10);
      expect(data.budgetId).toBeNull();
      expect(data.purpose).toBe('VISIT_FEE');
      expect(result.status).toBe(PaymentStatus.PENDING);
    });

    it('forbids a non-client from paying the visit', async () => {
      prisma.schedule.findUnique.mockResolvedValue(acceptedSchedule());
      await expectAppException(
        service.createVisitCheckout(
          { scheduleId: 10, method: PaymentMethodType.PIX, card: null },
          999,
        ),
        ErrorCode.SCHEDULE_FORBIDDEN,
      );
    });

    it('rejects paying the visit before the schedule is accepted', async () => {
      prisma.schedule.findUnique.mockResolvedValue(
        acceptedSchedule({ status: 'PENDING' }),
      );
      await expectAppException(
        service.createVisitCheckout(
          { scheduleId: 10, method: PaymentMethodType.PIX, card: null },
          CLIENT_ID,
        ),
        ErrorCode.SCHEDULE_INVALID_STATE,
      );
    });
  });

  describe('findById (refresh on poll)', () => {
    it('syncs a PENDING payment from the provider and settles the budget', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 900,
        budgetId: 55,
        purpose: 'BUDGET',
        kind: PaymentKind.ONE_TIME,
        method: PaymentMethodType.PIX,
        status: PaymentStatus.PENDING,
        providerPaymentId: 'pix_1',
        budget: { clientId: CLIENT_ID, workerId: WORKER_ID },
      });
      gateway.getPaymentStatus.mockResolvedValue(PaymentStatus.PAID);

      const result = await service.findById(900, CLIENT_ID);

      expect(gateway.getPaymentStatus).toHaveBeenCalledWith('pix_1');
      expect(result.status).toBe(PaymentStatus.PAID);
      expect(prisma.budget.update).toHaveBeenCalledWith({
        where: { id: 55 },
        data: { status: BudgetStatus.PAID },
      });
    });
  });

  describe('handleWebhook', () => {
    it('rejects an invalid signature', async () => {
      gateway.verifyWebhookSignature.mockReturnValue(false);
      await expectAppException(
        service.handleWebhook({ type: 'payment', dataId: 'pix_1' }),
        ErrorCode.UNAUTHORIZED,
      );
    });

    it('marks payment and budget as paid on a payment event', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 900,
        budgetId: 55,
        purpose: 'BUDGET',
        kind: PaymentKind.ONE_TIME,
        status: PaymentStatus.PENDING,
        providerPaymentId: 'pix_1',
      });
      gateway.getPaymentStatus.mockResolvedValue(PaymentStatus.PAID);

      await service.handleWebhook({ type: 'payment', dataId: 'pix_1' });

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 900 },
        data: { status: PaymentStatus.PAID },
      });
      expect(prisma.budget.update).toHaveBeenCalledWith({
        where: { id: 55 },
        data: { status: BudgetStatus.PAID },
      });
    });

    it('is idempotent when the payment is already paid', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 900,
        budgetId: 55,
        kind: PaymentKind.ONE_TIME,
        status: PaymentStatus.PAID,
        providerPaymentId: 'pix_1',
      });
      gateway.getPaymentStatus.mockResolvedValue(PaymentStatus.PAID);

      await service.handleWebhook({ type: 'payment', dataId: 'pix_1' });

      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });
});

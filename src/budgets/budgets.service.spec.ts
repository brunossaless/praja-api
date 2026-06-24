import { BudgetStatus, BudgetType, ScheduleStatus } from '@prisma/client';
import { AppException } from 'src/common/errors/app.exception';
import { ErrorCode } from 'src/common/errors/error-codes';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './budgets.dto';

const WORKER_ID = 9;
const CLIENT_ID = 123;

function buildMockPrisma() {
  return {
    schedule: { findUnique: jest.fn() },
    budget: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    // Visit-fee guard: default to "paid" so create tests focus on budget rules.
    payment: { findFirst: jest.fn().mockResolvedValue({ id: 1 }) },
  };
}

function acceptedSchedule() {
  return {
    id: 10,
    jobId: 1,
    requesterId: CLIENT_ID,
    status: ScheduleStatus.ACCEPTED,
    job: { userId: WORKER_ID },
  };
}

const createDto: CreateBudgetDto = {
  scheduleId: 10,
  title: 'Instalação de tomadas',
  type: BudgetType.ONE_TIME,
  items: [
    { description: 'Tomada 20A', quantity: 3, unitAmountCents: 2500 },
    { description: 'Mão de obra', quantity: 1, unitAmountCents: 12000 },
  ],
};

async function expectAppException(promise: Promise<unknown>, code: ErrorCode) {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  await promise.catch((err: AppException) => {
    expect((err.getResponse() as { code: string }).code).toBe(code);
  });
}

describe('BudgetsService', () => {
  let prisma: ReturnType<typeof buildMockPrisma>;
  let service: BudgetsService;

  beforeEach(() => {
    prisma = buildMockPrisma();
    service = new BudgetsService(prisma as never);
  });

  describe('create', () => {
    it('computes item amounts and totals on the server', async () => {
      prisma.schedule.findUnique.mockResolvedValue(acceptedSchedule());
      prisma.budget.findFirst.mockResolvedValue(null);
      prisma.budget.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 55,
          ...data,
          items: data.items.create.map((i: never, idx: number) => ({
            id: idx + 1,
            ...(i as object),
          })),
          worker: { id: WORKER_ID },
          client: { id: CLIENT_ID },
        }),
      );

      const result = await service.create(createDto, WORKER_ID);

      const data = prisma.budget.create.mock.calls[0][0].data;
      expect(data.items.create[0].amountCents).toBe(7500);
      expect(data.items.create[1].amountCents).toBe(12000);
      expect(data.subtotalCents).toBe(19500);
      expect(data.totalCents).toBe(19500);
      expect(data.status).toBe(BudgetStatus.SENT);
      expect(data.workerId).toBe(WORKER_ID);
      expect(data.clientId).toBe(CLIENT_ID);
      expect(result.totalCents).toBe(19500);
    });

    it('defaults recurrenceIntervalMonths to 1 for RECURRING budgets', async () => {
      prisma.schedule.findUnique.mockResolvedValue(acceptedSchedule());
      prisma.budget.findFirst.mockResolvedValue(null);
      prisma.budget.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 1, ...data, items: [], worker: {}, client: {} }),
      );

      await service.create(
        { ...createDto, type: BudgetType.RECURRING },
        WORKER_ID,
      );

      expect(
        prisma.budget.create.mock.calls[0][0].data.recurrenceIntervalMonths,
      ).toBe(1);
    });

    it('rejects a worker that does not own the job', async () => {
      prisma.schedule.findUnique.mockResolvedValue(acceptedSchedule());
      await expectAppException(
        service.create(createDto, 999),
        ErrorCode.BUDGET_FORBIDDEN,
      );
    });

    it('rejects when the schedule is not ACCEPTED', async () => {
      prisma.schedule.findUnique.mockResolvedValue({
        ...acceptedSchedule(),
        status: ScheduleStatus.PENDING,
      });
      await expectAppException(
        service.create(createDto, WORKER_ID),
        ErrorCode.BUDGET_INVALID_STATE,
      );
    });

    it('rejects a duplicate active budget for the schedule', async () => {
      prisma.schedule.findUnique.mockResolvedValue(acceptedSchedule());
      prisma.budget.findFirst.mockResolvedValue({
        id: 7,
        status: BudgetStatus.SENT,
      });
      await expectAppException(
        service.create(createDto, WORKER_ID),
        ErrorCode.BUDGET_INVALID_STATE,
      );
    });

    it('throws NOT_FOUND when the schedule does not exist', async () => {
      prisma.schedule.findUnique.mockResolvedValue(null);
      await expectAppException(
        service.create(createDto, WORKER_ID),
        ErrorCode.BUDGET_NOT_FOUND,
      );
    });

    it('requires the visit fee to be paid before creating a budget', async () => {
      prisma.schedule.findUnique.mockResolvedValue(acceptedSchedule());
      prisma.payment.findFirst.mockResolvedValue(null); // visit not paid
      await expectAppException(
        service.create(createDto, WORKER_ID),
        ErrorCode.VISIT_FEE_REQUIRED,
      );
    });
  });

  describe('respond', () => {
    function sentBudget() {
      return {
        id: 55,
        clientId: CLIENT_ID,
        workerId: WORKER_ID,
        status: BudgetStatus.SENT,
        items: [],
        worker: {},
        client: {},
      };
    }

    it('lets the client accept a SENT budget', async () => {
      prisma.budget.findUnique.mockResolvedValue(sentBudget());
      prisma.budget.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...sentBudget(), ...data }),
      );

      const result = await service.respond(
        55,
        { status: BudgetStatus.ACCEPTED, clientNote: 'Pode marcar.' },
        CLIENT_ID,
      );

      expect(prisma.budget.update.mock.calls[0][0].data.status).toBe(
        BudgetStatus.ACCEPTED,
      );
      expect(result.status).toBe(BudgetStatus.ACCEPTED);
    });

    it('forbids a non-client from responding', async () => {
      prisma.budget.findUnique.mockResolvedValue(sentBudget());
      await expectAppException(
        service.respond(55, { status: BudgetStatus.ACCEPTED }, 999),
        ErrorCode.BUDGET_FORBIDDEN,
      );
    });

    it('rejects responding to a budget that is not SENT', async () => {
      prisma.budget.findUnique.mockResolvedValue({
        ...sentBudget(),
        status: BudgetStatus.ACCEPTED,
      });
      await expectAppException(
        service.respond(55, { status: BudgetStatus.REJECTED }, CLIENT_ID),
        ErrorCode.BUDGET_INVALID_STATE,
      );
    });
  });

  describe('findBySchedule', () => {
    it('returns null when there is no budget for the participant', async () => {
      prisma.budget.findFirst.mockResolvedValue(null);
      await expect(service.findBySchedule(10, CLIENT_ID)).resolves.toBeNull();
    });
  });
});

import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PaymentPurpose,
  PaymentStatus,
  Prisma,
  ScheduleStatus,
} from '@prisma/client';
import { budgetInclude, serializeBudget } from 'src/budgets/budget.serializer';
import { PrismaService } from 'src/prisma/prisma.service';
import { userSummarySelect } from 'src/users/user.select';
import { VISIT_FEE_CENTS } from 'src/payments/visit-fee';
import { CreateScheduleDto, UpdateScheduleDto } from './schedules.dto';

/**
 * Shared include: provider/requester summaries, the latest budget and the
 * latest visit-fee payment (used to expose `visitPaid`).
 */
const scheduleInclude = {
  requester: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  job: {
    include: { user: { select: userSummarySelect } },
  },
  budgets: {
    take: 1,
    orderBy: { createdAt: 'desc' },
    include: budgetInclude,
  },
  payments: {
    where: { purpose: PaymentPurpose.VISIT_FEE },
    take: 1,
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.ScheduleInclude;

type ScheduleWithRelations = Prisma.ScheduleGetPayload<{
  include: typeof scheduleInclude;
}>;

@Injectable()
export class SchedulesService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateScheduleDto, requesterId: number) {
    return this.prisma.schedule.create({
      data: {
        jobId: data.jobId,
        requesterId,
        date: data.date,
        time: data.time,
        observation: data.observation,
      },
    });
  }

  async findAllRequests(userId: number, status?: ScheduleStatus) {
    const where: Prisma.ScheduleWhereInput = {
      requesterId: userId,
      ...(status ? { status } : {}),
    };

    const schedules = await this.prisma.schedule.findMany({
      where,
      include: scheduleInclude,
    });
    return schedules.map((schedule) => this.withBudget(schedule));
  }

  async findAllReceived(userId: number, status?: ScheduleStatus) {
    const where: Prisma.ScheduleWhereInput = {
      job: { userId },
      ...(status ? { status } : {}),
    };

    const schedules = await this.prisma.schedule.findMany({
      where,
      include: scheduleInclude,
    });
    return schedules.map((schedule) => this.withBudget(schedule));
  }

  async findById(id: number, userId?: number) {
    const schedule = await this.prisma.schedule.findFirst({
      where: {
        id,
        ...(userId
          ? {
              OR: [{ job: { userId } }, { requesterId: userId }],
            }
          : {}),
      },
      include: scheduleInclude,
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    return this.withBudget(schedule);
  }

  async update(id: number, data: UpdateScheduleDto) {
    await this.findById(id);
    return this.prisma.schedule.update({
      where: { id },
      data: {
        date: data.date,
        time: data.time,
        status: data.status,
        observation: data.observation,
        responseObservation: data.responseObservation,
      },
    });
  }

  async remove(id: number) {
    await this.findById(id);
    return this.prisma.schedule.delete({
      where: { id },
    });
  }

  /**
   * Flattens relations into the contract the app consumes: a single `budget`
   * (latest | null), the visit fee amount and whether it has been paid.
   */
  private withBudget(schedule: ScheduleWithRelations) {
    const { budgets, payments, ...rest } = schedule;
    return {
      ...rest,
      budget: budgets.length > 0 ? serializeBudget(budgets[0]) : null,
      visitFeeCents: VISIT_FEE_CENTS,
      visitPaid: payments.some((p) => p.status === PaymentStatus.PAID),
    };
  }
}

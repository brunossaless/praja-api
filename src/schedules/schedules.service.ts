import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ScheduleStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateScheduleDto, UpdateScheduleDto } from './schedules.dto';

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

  findAllRequests(userId: number, status?: ScheduleStatus) {
    const where: Prisma.ScheduleWhereInput = {
      requesterId: userId,
      ...(status ? { status } : {}),
    };

    return this.prisma.schedule.findMany({
      where,
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        job: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profession: true,
                certificate: true,
              },
            },
          },
        },
      },
    });
  }

  findAllReceived(userId: number, status?: ScheduleStatus) {
    const where: Prisma.ScheduleWhereInput = {
      job: { userId },
      ...(status ? { status } : {}),
    };

    return this.prisma.schedule.findMany({
      where,
      include: {
        job: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profession: true,
                certificate: true,
              },
            },
          },
        },
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
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
      include: {
        job: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profession: true,
                certificate: true,
              },
            },
          },
        },
      },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    return schedule;
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
}

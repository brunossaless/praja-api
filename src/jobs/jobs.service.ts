import { Injectable, NotFoundException } from '@nestjs/common';
import { Gender, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { userSummarySelect } from 'src/users/user.select';
import { CreateJobDto, UpdateJobDto } from './jobs.dto';

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateJobDto) {
    return this.prisma.job.create({
      data: {
        title: data.title,
        content: data.content,
        userId: data.userId,
        forWomen: data.forWomen ?? false,
      },
    });
  }

  /**
   * Lists jobs, embedding the provider summary.
   *
   * When `forWomen` is true, the "Para Mulheres" program rules apply: only
   * jobs flagged `forWomen` whose provider is a verified woman are returned.
   */
  findAll(forWomen?: boolean) {
    const where: Prisma.JobWhereInput = forWomen
      ? {
          forWomen: true,
          user: { gender: Gender.FEMALE, verified: true },
        }
      : {};

    return this.prisma.job.findMany({
      where,
      include: { user: { select: userSummarySelect } },
    });
  }

  async findById(id: number) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: { user: { select: userSummarySelect } },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async update(id: number, data: UpdateJobDto) {
    await this.findById(id);
    return this.prisma.job.update({
      where: { id },
      data: {
        title: data.title,
        content: data.content,
        forWomen: data.forWomen,
      },
    });
  }

  async remove(id: number) {
    await this.findById(id);
    return this.prisma.job.delete({
      where: { id },
    });
  }
}

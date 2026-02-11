import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
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
      },
    });
  }

  findAll() {
    return this.prisma.job.findMany({
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
    });
  }

  async findById(id: number) {
    const job = await this.prisma.job.findUnique({
      where: { id },
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

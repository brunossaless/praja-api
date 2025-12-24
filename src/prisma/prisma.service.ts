import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  onModuleInit() {
    this.$connect()
      .then(() => {
        console.log('Prisma connected to the database');
      })
      .catch((error) => {
        console.error('Error connecting Prisma to the database', error);
      });
  }
}

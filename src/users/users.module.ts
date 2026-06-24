import { Module } from '@nestjs/common';
import { StorageModule } from 'src/common/storage/storage.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}

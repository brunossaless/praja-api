import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { ScheduleBudgetController } from './schedule-budget.controller';

@Module({
  imports: [PrismaModule],
  controllers: [BudgetsController, ScheduleBudgetController],
  providers: [BudgetsService],
  exports: [BudgetsService],
})
export class BudgetsModule {}

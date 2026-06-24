import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AuthenticatedRequest } from 'src/common/types/authenticated-request';
import { BudgetsService } from './budgets.service';

/**
 * Nested route `GET /schedules/:scheduleId/budget` → `Budget | null`.
 * Kept in the budgets module so all budget logic lives together.
 */
@Controller('schedules/:scheduleId')
@UseGuards(JwtAuthGuard)
export class ScheduleBudgetController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get('budget')
  findBySchedule(
    @Req() req: AuthenticatedRequest,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
  ) {
    return this.budgetsService.findBySchedule(scheduleId, req.user.sub);
  }
}

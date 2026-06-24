import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AuthenticatedRequest } from 'src/common/types/authenticated-request';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto, RespondBudgetDto } from './budgets.dto';

@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  create(@Req() req: AuthenticatedRequest, @Body() body: CreateBudgetDto) {
    return this.budgetsService.create(body, req.user.sub);
  }

  @Get(':id')
  findById(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.budgetsService.findById(id, req.user.sub);
  }

  @Patch(':id/respond')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  respond(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RespondBudgetDto,
  ) {
    return this.budgetsService.respond(id, body, req.user.sub);
  }
}

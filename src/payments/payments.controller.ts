import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AuthenticatedRequest } from 'src/common/types/authenticated-request';
import { CreateCheckoutDto, CreateVisitCheckoutDto } from './payments.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  createCheckout(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateCheckoutDto,
  ) {
    return this.paymentsService.createCheckout(body, req.user.sub);
  }

  @Post('visit-checkout')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  createVisitCheckout(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateVisitCheckoutDto,
  ) {
    return this.paymentsService.createVisitCheckout(body, req.user.sub);
  }

  @Get(':id')
  findById(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.paymentsService.findById(id, req.user.sub);
  }
}

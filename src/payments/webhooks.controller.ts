import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { WebhookEventDto } from './webhook.dto';

/**
 * Mercado Pago webhook receiver. Public route — authenticity is enforced by
 * the `x-signature` HMAC, not by a JWT. MP may deliver the payment id either
 * in the body (`data.id`) or as the `data.id` query param.
 */
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('payments')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  handlePayments(
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
    @Query('data.id') queryDataId: string,
    @Body() body: WebhookEventDto,
  ) {
    const dataId = body?.data?.id ?? queryDataId;
    return this.paymentsService.handleWebhook({
      type: body?.type,
      dataId: dataId ? String(dataId) : undefined,
      xSignature,
      xRequestId,
    });
  }
}

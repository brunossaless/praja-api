import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MercadoPagoGateway } from './mercado-pago.gateway';
import { PaymentGateway } from './payment-gateway';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController, WebhooksController],
  providers: [
    PaymentsService,
    { provide: PaymentGateway, useClass: MercadoPagoGateway },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}

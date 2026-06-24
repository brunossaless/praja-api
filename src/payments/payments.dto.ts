import { PaymentKind, PaymentMethodType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CardDto {
  // Preferred path: card tokenized client-side with the Mercado Pago SDK.
  // When present, the raw card fields below are not required.
  @IsOptional()
  @IsString()
  token?: string;

  // Brand id (visa, master, amex...). Required by Mercado Pago when paying with
  // a token; auto-detected from the card number when raw fields are sent.
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @ValidateIf((o: CardDto) => !o.token)
  @IsString()
  @MinLength(2)
  holderName: string;

  @ValidateIf((o: CardDto) => !o.token)
  @IsString()
  @MinLength(12)
  number: string;

  @ValidateIf((o: CardDto) => !o.token)
  @IsString()
  expMonth: string;

  @ValidateIf((o: CardDto) => !o.token)
  @IsString()
  expYear: string;

  @ValidateIf((o: CardDto) => !o.token)
  @IsString()
  cvv: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  installments?: number;
}

export class CreateCheckoutDto {
  @IsInt()
  @Type(() => Number)
  budgetId: number;

  @IsEnum(PaymentMethodType, {
    message: 'O método deve ser PIX ou CREDIT_CARD',
  })
  method: PaymentMethodType;

  @IsEnum(PaymentKind, { message: 'O tipo deve ser ONE_TIME ou SUBSCRIPTION' })
  kind: PaymentKind;

  // Card data is required only for CREDIT_CARD. For PIX it may be null/absent.
  @ValidateIf(
    (o: CreateCheckoutDto) => o.method === PaymentMethodType.CREDIT_CARD,
  )
  @IsNotEmptyObject({}, { message: 'Os dados do cartão são obrigatórios' })
  @ValidateNested()
  @Type(() => CardDto)
  card?: CardDto | null;
}

/**
 * Checkout of the fixed visit fee, paid by the client to confirm the technical
 * visit. The amount is defined by the server (VISIT_FEE_CENTS), never the app.
 */
export class CreateVisitCheckoutDto {
  @IsInt()
  @Type(() => Number)
  scheduleId: number;

  @IsEnum(PaymentMethodType, {
    message: 'O método deve ser PIX ou CREDIT_CARD',
  })
  method: PaymentMethodType;

  @ValidateIf(
    (o: CreateVisitCheckoutDto) => o.method === PaymentMethodType.CREDIT_CARD,
  )
  @IsNotEmptyObject({}, { message: 'Os dados do cartão são obrigatórios' })
  @ValidateNested()
  @Type(() => CardDto)
  card?: CardDto | null;
}

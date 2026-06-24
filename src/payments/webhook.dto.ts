import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

export class WebhookDataDto {
  // Mercado Pago payment id; may also arrive via the `data.id` query param.
  @IsOptional()
  @IsString()
  id?: string;
}

/**
 * Mercado Pago notification body, e.g.:
 * `{ "type": "payment", "action": "payment.updated", "data": { "id": "123" } }`
 */
export class WebhookEventDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WebhookDataDto)
  data?: WebhookDataDto;
}

/** Normalized webhook params passed from the controller to the service. */
export interface WebhookInput {
  type?: string;
  dataId?: string;
  xSignature?: string;
  xRequestId?: string;
}

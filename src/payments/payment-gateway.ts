import { PaymentStatus } from '@prisma/client';
import { CardDto } from './payments.dto';

export interface PixChargeInput {
  amountCents: number;
  description: string;
  payerEmail: string;
}

export interface PixCharge {
  providerPaymentId: string;
  qrCodeText: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  expiresAt: Date | null;
}

export interface CardChargeInput {
  amountCents: number;
  description: string;
  payerEmail: string;
  installments?: number;
  card: CardDto;
}

export interface CardChargeResult {
  providerPaymentId: string;
  status: PaymentStatus;
}

export interface WebhookSignatureInput {
  xSignature?: string;
  xRequestId?: string;
  dataId?: string;
}

/**
 * Payment provider contract. Swap the concrete implementation in
 * {@link PaymentsModule} to change gateways without touching the service.
 */
export abstract class PaymentGateway {
  abstract readonly provider: string;

  /** Creates a PIX charge and returns the copy-paste code / QR. */
  abstract createPixCharge(input: PixChargeInput): Promise<PixCharge>;

  /** Captures a card payment (tokenizing raw card data when needed). */
  abstract chargeCard(input: CardChargeInput): Promise<CardChargeResult>;

  /** Reads the current status of a provider payment (used on poll/webhook). */
  abstract getPaymentStatus(
    providerPaymentId: string,
  ): Promise<PaymentStatus | null>;

  /** Validates the webhook signature. */
  abstract verifyWebhookSignature(input: WebhookSignatureInput): boolean;
}

/** Thrown by gateway implementations to signal a provider/transport failure. */
export class GatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'GatewayError';
  }

  /** 4xx responses are treated as a declined/invalid request, not an outage. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

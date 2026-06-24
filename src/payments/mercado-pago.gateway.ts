import { Injectable, Logger } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import {
  CardChargeInput,
  CardChargeResult,
  GatewayError,
  PaymentGateway,
  PixCharge,
  PixChargeInput,
  WebhookSignatureInput,
} from './payment-gateway';
import { CardDto } from './payments.dto';

/** Maps a Mercado Pago payment status to our internal PaymentStatus. */
const STATUS_MAP: Record<string, PaymentStatus> = {
  approved: PaymentStatus.PAID,
  pending: PaymentStatus.PENDING,
  in_process: PaymentStatus.PROCESSING,
  authorized: PaymentStatus.PROCESSING,
  rejected: PaymentStatus.FAILED,
  cancelled: PaymentStatus.CANCELED,
  refunded: PaymentStatus.REFUNDED,
  charged_back: PaymentStatus.REFUNDED,
};

/**
 * Real Mercado Pago gateway over the REST API (sandbox-compatible).
 * Docs: https://www.mercadopago.com.br/developers
 */
@Injectable()
export class MercadoPagoGateway extends PaymentGateway {
  readonly provider = 'mercadopago';
  private readonly logger = new Logger(MercadoPagoGateway.name);
  private readonly baseUrl = (
    process.env.MP_BASE_URL ?? 'https://api.mercadopago.com'
  ).replace(/\/$/, '');

  async createPixCharge(input: PixChargeInput): Promise<PixCharge> {
    const payment = await this.request('POST', '/v1/payments', {
      transaction_amount: this.toAmount(input.amountCents),
      description: input.description,
      payment_method_id: 'pix',
      payer: { email: input.payerEmail },
    });

    const tx = payment.point_of_interaction?.transaction_data ?? {};
    return {
      providerPaymentId: String(payment.id),
      qrCodeText: tx.qr_code ?? null,
      qrCodeBase64: tx.qr_code_base64 ?? null,
      ticketUrl: tx.ticket_url ?? null,
      expiresAt: payment.date_of_expiration
        ? new Date(payment.date_of_expiration)
        : null,
    };
  }

  async chargeCard(input: CardChargeInput): Promise<CardChargeResult> {
    try {
      const card = input.card;
      const token = card.token ?? (await this.createCardToken(card));
      const paymentMethodId =
        card.paymentMethodId ??
        (card.number ? this.detectBrand(card.number) : undefined);

      const payment = await this.request('POST', '/v1/payments', {
        transaction_amount: this.toAmount(input.amountCents),
        description: input.description,
        token,
        installments: input.installments ?? 1,
        ...(paymentMethodId ? { payment_method_id: paymentMethodId } : {}),
        payer: { email: input.payerEmail },
      });

      return {
        providerPaymentId: String(payment.id),
        status: this.mapStatus(payment.status) ?? PaymentStatus.PROCESSING,
      };
    } catch (error) {
      // A 4xx (invalid card/token, declined) is a FAILED payment, not an outage.
      if (error instanceof GatewayError && error.isClientError) {
        this.logger.warn(`Card declined by Mercado Pago: ${error.message}`);
        return {
          providerPaymentId: `mp_declined_${randomUUID()}`,
          status: PaymentStatus.FAILED,
        };
      }
      throw error;
    }
  }

  async getPaymentStatus(
    providerPaymentId: string,
  ): Promise<PaymentStatus | null> {
    const payment = await this.request(
      'GET',
      `/v1/payments/${providerPaymentId}`,
    );
    return this.mapStatus(payment.status);
  }

  /**
   * Validates the `x-signature` header using Mercado Pago's manifest:
   * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` hashed with HMAC-SHA256.
   * When `MP_WEBHOOK_SECRET` is unset (dev), validation is skipped.
   */
  verifyWebhookSignature({
    xSignature,
    xRequestId,
    dataId,
  }: WebhookSignatureInput): boolean {
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.warn(
        'MP_WEBHOOK_SECRET not set — skipping signature validation (dev only).',
      );
      return true;
    }
    if (!xSignature || !dataId) return false;

    const parts = Object.fromEntries(
      xSignature.split(',').map((p) => {
        const [k, v] = p.split('=');
        return [k?.trim(), v?.trim()];
      }),
    );
    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;

    const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId ?? ''};ts:${ts};`;
    const expected = createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    const expectedBuf = Buffer.from(expected);
    const givenBuf = Buffer.from(v1);
    if (expectedBuf.length !== givenBuf.length) return false;
    return timingSafeEqual(expectedBuf, givenBuf);
  }

  // --- internals -----------------------------------------------------------

  private async createCardToken(card: CardDto): Promise<string> {
    // Mercado Pago expects a 4-digit year; normalize "30" -> "2030".
    const expYear =
      card.expYear?.length === 2 ? `20${card.expYear}` : card.expYear;
    const token = await this.request('POST', '/v1/card_tokens', {
      card_number: card.number.replace(/\D/g, ''),
      expiration_month: Number(card.expMonth),
      expiration_year: Number(expYear),
      security_code: card.cvv,
      cardholder: { name: card.holderName },
    });
    return token.id;
  }

  private mapStatus(status?: string): PaymentStatus | null {
    return status ? (STATUS_MAP[status] ?? null) : null;
  }

  private toAmount(cents: number): number {
    return Math.round(cents) / 100;
  }

  private detectBrand(rawNumber: string): string | undefined {
    const n = rawNumber.replace(/\D/g, '');
    if (/^4/.test(n)) return 'visa';
    if (/^3[47]/.test(n)) return 'amex';
    if (/^(5[1-5]|2[2-7])/.test(n)) return 'master';
    if (/^(50|509|6500|6504|6505|6516)/.test(n)) return 'elo';
    if (/^(606282|3841)/.test(n)) return 'hipercard';
    return undefined;
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<any> {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      throw new GatewayError('MP_ACCESS_TOKEN is not set', 503);
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    if (method === 'POST') headers['X-Idempotency-Key'] = randomUUID();

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      throw new GatewayError(`Network error calling ${path}`, 503, error);
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        (json as { message?: string })?.message ?? `MP ${path} ${res.status}`;
      this.logger.error(`MP ${method} ${path} -> ${res.status}`);
      throw new GatewayError(message, res.status, json);
    }
    return json;
  }
}

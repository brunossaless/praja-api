import { PaymentStatus } from '@prisma/client';
import { createHmac } from 'crypto';
import { MercadoPagoGateway } from './mercado-pago.gateway';
import { CardDto } from './payments.dto';

function mockFetchOnce(status: number, body: unknown) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

const goodCard: CardDto = {
  holderName: 'APRO',
  number: '4235647728025682',
  expMonth: '12',
  expYear: '2030',
  cvv: '123',
};

describe('MercadoPagoGateway', () => {
  let gateway: MercadoPagoGateway;

  beforeEach(() => {
    gateway = new MercadoPagoGateway();
    global.fetch = jest.fn();
    process.env.MP_ACCESS_TOKEN = 'TEST-token';
    delete process.env.MP_WEBHOOK_SECRET;
  });

  it('creates a PIX charge and maps the QR fields', async () => {
    mockFetchOnce(201, {
      id: 123456,
      status: 'pending',
      date_of_expiration: '2030-01-01T10:30:00.000-03:00',
      point_of_interaction: {
        transaction_data: {
          qr_code: '00020126...BR6304ABCD',
          qr_code_base64: 'iVBORw0KGgo=',
          ticket_url: 'https://mp/ticket/123',
        },
      },
    });

    const charge = await gateway.createPixCharge({
      amountCents: 19500,
      description: 'Serviço',
      payerEmail: 'ana@email.com',
    });

    expect(charge.providerPaymentId).toBe('123456');
    expect(charge.qrCodeText).toBe('00020126...BR6304ABCD');
    expect(charge.qrCodeBase64).toBe('iVBORw0KGgo=');
    expect(charge.expiresAt).toBeInstanceOf(Date);
  });

  it('tokenizes and approves a card', async () => {
    mockFetchOnce(201, { id: 'card_token_1' }); // /v1/card_tokens
    mockFetchOnce(201, { id: 789, status: 'approved' }); // /v1/payments

    const result = await gateway.chargeCard({
      amountCents: 19500,
      description: 'Serviço',
      payerEmail: 'ana@email.com',
      installments: 3,
      card: goodCard,
    });

    expect(result.providerPaymentId).toBe('789');
    expect(result.status).toBe(PaymentStatus.PAID);
  });

  it('returns FAILED on a 4xx from the provider (declined)', async () => {
    mockFetchOnce(201, { id: 'card_token_1' });
    mockFetchOnce(400, { message: 'cc_rejected' });

    const result = await gateway.chargeCard({
      amountCents: 19500,
      description: 'Serviço',
      payerEmail: 'ana@email.com',
      card: goodCard,
    });

    expect(result.status).toBe(PaymentStatus.FAILED);
  });

  it('maps provider status on getPaymentStatus', async () => {
    mockFetchOnce(200, { id: 789, status: 'approved' });
    await expect(gateway.getPaymentStatus('789')).resolves.toBe(
      PaymentStatus.PAID,
    );
  });

  describe('verifyWebhookSignature', () => {
    it('skips validation when no secret is configured (dev)', () => {
      expect(
        gateway.verifyWebhookSignature({
          dataId: '1',
          xSignature: 'ts=1,v1=x',
        }),
      ).toBe(true);
    });

    it('validates the manifest HMAC (ts=...,v1=...)', () => {
      process.env.MP_WEBHOOK_SECRET = 'shhh';
      const dataId = '12345';
      const xRequestId = 'req-1';
      const ts = '1700000000';
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
      const v1 = createHmac('sha256', 'shhh').update(manifest).digest('hex');

      expect(
        gateway.verifyWebhookSignature({
          dataId,
          xRequestId,
          xSignature: `ts=${ts},v1=${v1}`,
        }),
      ).toBe(true);

      expect(
        gateway.verifyWebhookSignature({
          dataId,
          xRequestId,
          xSignature: `ts=${ts},v1=deadbeef`,
        }),
      ).toBe(false);

      expect(
        gateway.verifyWebhookSignature({ xSignature: `ts=${ts},v1=${v1}` }),
      ).toBe(false);
    });
  });
});

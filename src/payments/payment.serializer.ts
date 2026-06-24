import { Payment, PaymentMethodType } from '@prisma/client';

/**
 * Maps a Payment row to the contract the app expects. The `pix` block is only
 * present for PIX payments; for card it is `null` and `status` already
 * reflects the capture result (PAID/FAILED).
 */
export function serializePayment(payment: Payment) {
  return {
    id: payment.id,
    budgetId: payment.budgetId,
    method: payment.method,
    kind: payment.kind,
    status: payment.status,
    amountCents: payment.amountCents,
    currency: payment.currency,
    pix:
      payment.method === PaymentMethodType.PIX
        ? {
            qrCodeText: payment.pixQrCodeText,
            qrCodeBase64: payment.pixQrCodeBase64,
            expiresAt: payment.pixExpiresAt,
          }
        : null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

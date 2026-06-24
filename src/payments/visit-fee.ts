/**
 * Fixed fee (in cents) charged to the client to confirm the technical visit,
 * paid before the provider sends the service budget. Override via env.
 */
export const VISIT_FEE_CENTS = Number(process.env.VISIT_FEE_CENTS ?? 2500);

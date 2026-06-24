import { Prisma } from '@prisma/client';

/**
 * Prisma include used everywhere a Budget is returned, so the serialized
 * shape (items + worker/client summaries) is consistent across modules.
 */
export const budgetInclude = {
  items: { orderBy: { id: 'asc' } },
  worker: { select: { id: true, name: true, avatarUrl: true, verified: true } },
  client: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.BudgetInclude;

export type BudgetWithRelations = Prisma.BudgetGetPayload<{
  include: typeof budgetInclude;
}>;

/**
 * Maps a Budget row (with relations) to the exact contract the app expects.
 * Monetary values stay in cents; dates are serialized as UTC ISO strings by
 * the JSON layer.
 */
export function serializeBudget(budget: BudgetWithRelations) {
  return {
    id: budget.id,
    scheduleId: budget.scheduleId,
    jobId: budget.jobId,
    workerId: budget.workerId,
    clientId: budget.clientId,
    title: budget.title,
    description: budget.description,
    type: budget.type,
    status: budget.status,
    items: budget.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitAmountCents: item.unitAmountCents,
      amountCents: item.amountCents,
    })),
    subtotalCents: budget.subtotalCents,
    totalCents: budget.totalCents,
    currency: budget.currency,
    recurrenceIntervalMonths: budget.recurrenceIntervalMonths,
    clientNote: budget.clientNote,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
    worker: budget.worker,
    client: budget.client,
  };
}

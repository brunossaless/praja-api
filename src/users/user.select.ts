import { Prisma } from '@prisma/client';

/**
 * Full self-profile returned by auth (register/login) and avatar upload.
 * Never includes the password hash.
 */
export const userSelfSelect = {
  id: true,
  email: true,
  name: true,
  type: true,
  profession: true,
  cpf: true,
  rg: true,
  certificate: true,
  avatarUrl: true,
  gender: true,
  verified: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

/**
 * Public summary of a provider, embedded in jobs and schedules.
 * Carries the fields the app needs for the "Para Mulheres" badge.
 */
export const userSummarySelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  gender: true,
  verified: true,
  profession: true,
  certificate: true,
} satisfies Prisma.UserSelect;

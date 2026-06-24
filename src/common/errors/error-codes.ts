import { HttpStatus } from '@nestjs/common';

/**
 * Standardized error codes shared between the API and the app.
 * The app reads `error.response.data.message` to show a friendly message,
 * while `code` lets it branch on specific business rules.
 */
export const ErrorCode = {
  // Generic
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // Uploads
  UPLOAD_INVALID_FILE: 'UPLOAD_INVALID_FILE',

  // Budgets
  BUDGET_FORBIDDEN: 'BUDGET_FORBIDDEN',
  BUDGET_NOT_FOUND: 'BUDGET_NOT_FOUND',
  BUDGET_INVALID_STATE: 'BUDGET_INVALID_STATE',
  VISIT_FEE_REQUIRED: 'VISIT_FEE_REQUIRED',

  // Schedules
  SCHEDULE_NOT_FOUND: 'SCHEDULE_NOT_FOUND',
  SCHEDULE_FORBIDDEN: 'SCHEDULE_FORBIDDEN',
  SCHEDULE_INVALID_STATE: 'SCHEDULE_INVALID_STATE',

  // Payments
  PAYMENT_BUDGET_NOT_ACCEPTED: 'PAYMENT_BUDGET_NOT_ACCEPTED',
  PAYMENT_CARD_DECLINED: 'PAYMENT_CARD_DECLINED',
  PAYMENT_PROVIDER_UNAVAILABLE: 'PAYMENT_PROVIDER_UNAVAILABLE',
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  PAYMENT_INVALID_STATE: 'PAYMENT_INVALID_STATE',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Default HTTP status for each business error code, used by the
 * {@link AppException} factory when a status is not provided explicitly.
 */
export const ERROR_STATUS: Record<ErrorCode, HttpStatus> = {
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,

  UPLOAD_INVALID_FILE: HttpStatus.BAD_REQUEST,

  BUDGET_FORBIDDEN: HttpStatus.FORBIDDEN,
  BUDGET_NOT_FOUND: HttpStatus.NOT_FOUND,
  BUDGET_INVALID_STATE: HttpStatus.CONFLICT,
  VISIT_FEE_REQUIRED: HttpStatus.CONFLICT,

  SCHEDULE_NOT_FOUND: HttpStatus.NOT_FOUND,
  SCHEDULE_FORBIDDEN: HttpStatus.FORBIDDEN,
  SCHEDULE_INVALID_STATE: HttpStatus.CONFLICT,

  PAYMENT_BUDGET_NOT_ACCEPTED: HttpStatus.CONFLICT,
  PAYMENT_CARD_DECLINED: HttpStatus.PAYMENT_REQUIRED,
  PAYMENT_PROVIDER_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  PAYMENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  PAYMENT_INVALID_STATE: HttpStatus.CONFLICT,
};

/**
 * Maps a raw HTTP status to a generic error code, used to normalize
 * built-in Nest exceptions that do not carry a business code.
 */
export function codeForStatus(status: number): ErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ErrorCode.VALIDATION_ERROR;
    case HttpStatus.UNAUTHORIZED:
      return ErrorCode.UNAUTHORIZED;
    case HttpStatus.FORBIDDEN:
      return ErrorCode.FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      return ErrorCode.NOT_FOUND;
    case HttpStatus.CONFLICT:
      return ErrorCode.CONFLICT;
    default:
      return ErrorCode.INTERNAL_ERROR;
  }
}

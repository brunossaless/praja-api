import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_STATUS, ErrorCode } from './error-codes';

export interface AppErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

/**
 * Business exception with the standardized error contract consumed by the app:
 *
 * ```json
 * { "code": "BUDGET_INVALID_STATE", "message": "Mensagem amigável.", "details": {} }
 * ```
 *
 * The HTTP status is derived from {@link ERROR_STATUS} unless overridden.
 */
export class AppException extends HttpException {
  constructor(
    code: ErrorCode,
    message: string,
    details: Record<string, unknown> = {},
    status?: HttpStatus,
  ) {
    const body: AppErrorBody = { code, message, details };
    super(body, status ?? ERROR_STATUS[code] ?? HttpStatus.BAD_REQUEST);
  }
}

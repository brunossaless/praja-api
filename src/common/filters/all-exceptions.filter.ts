import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AppErrorBody } from '../errors/app.exception';
import { codeForStatus, ErrorCode } from '../errors/error-codes';

/**
 * Normalizes every error thrown by the API to the standardized contract:
 *
 * ```json
 * { "code": "STRING", "message": "Mensagem amigável.", "details": {} }
 * ```
 *
 * - {@link AppException} bodies already follow the contract and pass through.
 * - Built-in Nest exceptions (validation, auth guards, etc.) are mapped to a
 *   generic code derived from their HTTP status.
 * - Unknown errors become a 500 with a safe generic message.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: AppErrorBody = {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Erro interno do servidor.',
      details: {},
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      body = this.normalizeHttpException(res, status);
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    response.status(status).json(body);
  }

  private normalizeHttpException(
    res: string | object,
    status: number,
  ): AppErrorBody {
    if (typeof res === 'string') {
      return { code: codeForStatus(status), message: res, details: {} };
    }

    const raw = res as Record<string, any>;

    // Already a standardized AppException body.
    if (typeof raw.code === 'string' && typeof raw.message === 'string') {
      return {
        code: raw.code,
        message: raw.message,
        details: (raw.details as Record<string, unknown>) ?? {},
      };
    }

    // Built-in Nest exception shape: { statusCode, message, error }.
    const rawMessage = raw.message;
    const message = Array.isArray(rawMessage)
      ? String(rawMessage[0])
      : String(rawMessage ?? raw.error ?? 'Erro inesperado.');

    return {
      code: codeForStatus(status),
      message,
      details: Array.isArray(rawMessage) ? { errors: rawMessage } : {},
    };
  }
}

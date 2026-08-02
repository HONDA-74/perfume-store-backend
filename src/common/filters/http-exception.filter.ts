import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ERROR_MESSAGES } from '../constants/error-messages.constant';

interface NestErrorBody {
  message?: string | string[];
  error?: string;
}

/**
 * Global fallback exception filter (AI_RULES.md §18-19).
 *
 * Registered with a bare @Catch() so it catches every exception not already
 * handled by MongoExceptionFilter — this is what allows every path in the
 * exception flow (validation, business/domain, unexpected) to converge on
 * one standardized envelope, matching SYSTEM_ARCHITECTURE.md §10, without
 * introducing a third filter file beyond what §3's folder tree defines.
 *
 * - NestJS HttpException instances (ValidationPipe errors, domain exceptions
 *   thrown by services) are formatted using their own status and message.
 * - Anything else is treated as an unexpected error: logged with full detail
 *   server-side, but returned to the client as a generic 500 with no stack
 *   trace, regardless of environment (§18 — never expose stack traces in
 *   production).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const { message, errors } = this.normalizeHttpException(exception, status);

      this.logger.warn(`${request.method} ${request.originalUrl} -> ${status} ${message}`);

      response.status(status).json({ success: false, message, errors });
      return;
    }

    const error = exception as Error;
    this.logger.error(
      `${request.method} ${request.originalUrl} -> 500 Unexpected Error`,
      error?.stack,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.UNEXPECTED_ERROR,
      errors: [],
    });
  }

  private normalizeHttpException(
    exception: HttpException,
    status: number,
  ): { message: string; errors: unknown[] } {
    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return { message: exceptionResponse, errors: [] };
    }

    const body = exceptionResponse as NestErrorBody;
    const rawMessage = body.message;

    if (Array.isArray(rawMessage)) {
      return {
        message:
          status === HttpStatus.BAD_REQUEST
            ? ERROR_MESSAGES.VALIDATION_FAILED
            : ERROR_MESSAGES.UNEXPECTED_ERROR,
        errors: rawMessage,
      };
    }

    return { message: rawMessage ?? body.error ?? ERROR_MESSAGES.UNEXPECTED_ERROR, errors: [] };
  }
}

import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { Error as MongooseError } from 'mongoose';
import { ERROR_MESSAGES } from '../constants/error-messages.constant';

interface MongoDriverErrorShape {
  name?: string;
  code?: number;
  keyValue?: Record<string, unknown>;
  message: string;
  stack?: string;
}

/**
 * Normalizes Mongoose/MongoDB driver-level errors (invalid ObjectId casts,
 * duplicate-key violations, schema validation failures) into the standard
 * error envelope. Raw Mongo error text is never exposed to the client
 * (AI_RULES.md §18, §32).
 */
@Catch(MongooseError, MongooseError.CastError, MongooseError.ValidationError)
export class MongoExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MongoExceptionFilter.name);

  catch(exception: MongoDriverErrorShape, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    this.logger.error(exception.message, exception.stack);

    if (exception.name === 'CastError') {
      response.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: ERROR_MESSAGES.INVALID_IDENTIFIER,
        errors: [],
      });
      return;
    }

    if (exception.code === 11000) {
      const duplicateField = exception.keyValue ? Object.keys(exception.keyValue)[0] : undefined;
      response.status(HttpStatus.CONFLICT).json({
        success: false,
        message: duplicateField
          ? `A record with this ${duplicateField} already exists.`
          : ERROR_MESSAGES.DUPLICATE_RESOURCE,
        errors: [],
      });
      return;
    }

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      success: false,
      message: ERROR_MESSAGES.DATABASE_ERROR,
      errors: [],
    });
  }
}

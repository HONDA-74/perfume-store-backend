import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { MongoServerError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';
import { ERROR_MESSAGES } from '../constants/error-messages.constant';
import { buildErrorResponse } from '../utils/response.util';

interface MongoDriverErrorShape {
  name?: string;
  code?: number;
  keyValue?: Record<string, unknown>;
  message: string;
  stack?: string;
}

/**
 * Catches both Mongoose-layer errors (CastError, ValidationError) and raw
 * MongoDB-driver errors (MongoServerError, e.g. E11000 duplicate key) —
 * the latter never extend mongoose.Error, so both must be listed explicitly
 * for the documented 409/400 behavior in API_BLUEPRINT.md to hold.
 */
@Catch(MongooseError, MongoServerError)
export class MongoExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MongoExceptionFilter.name);

  catch(exception: MongoDriverErrorShape, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    this.logger.error(exception.message, exception.stack);

    if (exception.name === 'CastError') {
      response
        .status(HttpStatus.BAD_REQUEST)
        .json(buildErrorResponse(ERROR_MESSAGES.INVALID_IDENTIFIER));
      return;
    }

    if (exception.code === 11000) {
      const duplicateField = exception.keyValue ? Object.keys(exception.keyValue)[0] : undefined;
      response
        .status(HttpStatus.CONFLICT)
        .json(
          buildErrorResponse(
            duplicateField
              ? `A record with this ${duplicateField} already exists.`
              : ERROR_MESSAGES.DUPLICATE_RESOURCE,
          ),
        );
      return;
    }

    response
      .status(HttpStatus.UNPROCESSABLE_ENTITY)
      .json(buildErrorResponse(ERROR_MESSAGES.DATABASE_ERROR));
  }
}

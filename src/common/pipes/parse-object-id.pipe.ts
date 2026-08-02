import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';
import { ERROR_MESSAGES } from '../constants/error-messages.constant';

/**
 * Short-circuits malformed :id route params to 400 before they reach the
 * database as an uncontrolled Mongo CastError (API_BLUEPRINT.md §11.4).
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isValidObjectId(value)) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_OBJECT_ID);
    }
    return value;
  }
}

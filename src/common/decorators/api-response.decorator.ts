import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

/**
 * Documents an endpoint's success response using the standardized envelope
 * from AI_RULES.md §19, wrapping the given DTO in { success, message, data, meta }.
 */
export const ApiSuccessResponse = <TModel extends Type<unknown>>(model: TModel, isArray = false) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: isArray
            ? { type: 'array', items: { $ref: getSchemaPath(model) } }
            : { $ref: getSchemaPath(model) },
          meta: { type: 'object', nullable: true },
        },
      },
    }),
  );

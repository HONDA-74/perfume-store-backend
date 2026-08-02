import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SUCCESS_MESSAGES } from '../constants/success-messages.constant';
import { ApiResponse } from '../types/interfaces/api-response.interface';

/**
 * Wraps whatever the controller returns into the standardized success
 * envelope. Controllers/services return plain domain data or a
 * `{ items, meta }` paginated shape (common/types/interfaces/paginated-result.interface.ts);
 * this interceptor never contains business logic itself (§2 Controller / §19).
 */
@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((result): ApiResponse<T> => {
        const response = context.switchToHttp().getResponse();
        const { data, meta } = this.extractPayload(result);

        return {
          success: true,
          message: SUCCESS_MESSAGES.OPERATION_SUCCESSFUL,
          data: response.statusCode === 204 ? undefined : (data as T),
          ...(meta ? { meta } : {}),
        };
      }),
    );
  }

  private extractPayload(result: unknown): { data: unknown; meta?: Record<string, unknown> } {
    if (
      result &&
      typeof result === 'object' &&
      'items' in (result as Record<string, unknown>) &&
      'meta' in (result as Record<string, unknown>)
    ) {
      const { items, meta } = result as { items: unknown; meta: Record<string, unknown> };
      return { data: items, meta };
    }

    return { data: result ?? null };
  }
}

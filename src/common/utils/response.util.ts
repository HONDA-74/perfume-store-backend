import { SUCCESS_MESSAGES } from '../constants/success-messages.constant';
import { ApiResponse } from '../types/interfaces/api-response.interface';

export function buildSuccessResponse<T>(
  data: T,
  message: string = SUCCESS_MESSAGES.OPERATION_SUCCESSFUL,
  meta?: Record<string, unknown>,
): ApiResponse<T> {
  return {
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  };
}

export function buildErrorResponse(message: string, errors: unknown[] = []): ApiResponse<never> {
  return {
    success: false,
    message,
    errors,
  } as ApiResponse<never>;
}

import { APP_CONSTANTS } from '../constants/app.constant';
import { PaginationMeta } from '../types/interfaces/paginated-result.interface';

export interface NormalizedPagination {
  page: number;
  limit: number;
  skip: number;
}

export function normalizePagination(page?: number, limit?: number): NormalizedPagination {
  const normalizedPage = page && page > 0 ? Math.floor(page) : APP_CONSTANTS.DEFAULT_PAGE;
  const normalizedLimit =
    limit && limit > 0
      ? Math.min(Math.floor(limit), APP_CONSTANTS.MAX_LIMIT)
      : APP_CONSTANTS.DEFAULT_LIMIT;

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    skip: (normalizedPage - 1) * normalizedLimit,
  };
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  totalItems: number,
): PaginationMeta {
  return {
    page,
    limit,
    totalItems,
    totalPages: Math.max(Math.ceil(totalItems / limit), 1),
  };
}

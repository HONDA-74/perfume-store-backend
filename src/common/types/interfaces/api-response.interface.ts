/**
 * Standard success/error envelope shape.
 * Mirrors AI_RULES.md §19 (Global Response Format) and API_BLUEPRINT.md §1.2-1.3.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
  errors?: unknown[];
}

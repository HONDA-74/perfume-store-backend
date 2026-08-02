/**
 * Generic, feature-agnostic literals reused across modules.
 * Feature-specific constants (e.g. product filter whitelist) belong in
 * their owning module's own constants/ folder, per AI_RULES.md §8.
 */
export const APP_CONSTANTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 50,
  DEFAULT_SORT: 'createdAt:desc',
  REQUEST_TIMEOUT_MS: 30_000,
} as const;

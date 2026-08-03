/**
 * Module-owned constants (AI_RULES.md §35 — avoid magic strings). Kept
 * inside `modules/brands/constants/`, not `common/`, since these are
 * feature-specific (SYSTEM_ARCHITECTURE.md §6.2).
 */
export const BRAND_MESSAGES = {
  NOT_FOUND: 'Brand not found.',
  DUPLICATE_NAME: 'A brand with this name already exists.',
  DUPLICATE_SLUG: 'A brand with this slug already exists.',
} as const;

/** Maps whitelisted QueryBrandDto.sort values to Mongoose sort specs. */
export const BRAND_SORT_FIELD_MAP: Record<string, Record<string, 1 | -1>> = {
  'name:asc': { name: 1 },
  'name:desc': { name: -1 },
  'createdAt:asc': { createdAt: 1 },
  'createdAt:desc': { createdAt: -1 },
};

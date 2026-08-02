/**
 * Module-owned constants (AI_RULES.md §35 — avoid magic strings). Kept
 * inside `modules/categories/constants/`, not `common/`, since these are
 * feature-specific (SYSTEM_ARCHITECTURE.md §6.2).
 */
export const CATEGORY_MESSAGES = {
  NOT_FOUND: 'Category not found.',
  DUPLICATE_NAME: 'A category with this name already exists.',
  DUPLICATE_SLUG: 'A category with this slug already exists.',
} as const;

/** Maps whitelisted QueryCategoryDto.sort values to Mongoose sort specs. */
export const CATEGORY_SORT_FIELD_MAP: Record<string, Record<string, 1 | -1>> = {
  'name:asc': { name: 1 },
  'name:desc': { name: -1 },
  'createdAt:asc': { createdAt: 1 },
  'createdAt:desc': { createdAt: -1 },
};

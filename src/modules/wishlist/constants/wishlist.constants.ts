/**
 * Module-owned constants (AI_RULES.md §35 — avoid magic strings). Kept
 * inside `modules/wishlist/constants/`, not `common/`, since these are
 * feature-specific (SYSTEM_ARCHITECTURE.md §6.2).
 */
export const WISHLIST_MESSAGES = {
  ALREADY_IN_WISHLIST: 'This product is already in your wishlist.',
  ITEM_NOT_FOUND: 'This product is not in your wishlist.',
} as const;

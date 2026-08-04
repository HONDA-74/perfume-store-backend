/**
 * Module-owned constants (AI_RULES.md §35 — avoid magic strings). Kept
 * inside `modules/cart/constants/`, not `common/`, since these are
 * feature-specific (SYSTEM_ARCHITECTURE.md §6.2).
 */
export const CART_MESSAGES = {
  ITEM_NOT_FOUND: 'This product is not in your cart.',
  INSUFFICIENT_STOCK: 'Requested quantity exceeds available stock.',
} as const;

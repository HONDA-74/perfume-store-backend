import { OrderStatus } from '../../../common/types/enums/order-status.enum';

/**
 * Module-owned constants (AI_RULES.md §35 — avoid magic strings). Kept
 * inside `modules/orders/constants/`, not `common/`, since these are
 * feature-specific (SYSTEM_ARCHITECTURE.md §6.2).
 */
export const ORDER_MESSAGES = {
  NOT_FOUND: 'Order not found.',
  EMPTY_CART: 'Your cart is empty. Add items before checking out.',
  INVALID_ADDRESS: 'The provided address does not belong to your account.',
  FORBIDDEN: 'You do not have permission to access this order.',
  INVALID_STATUS_TRANSITION: 'This status transition is not allowed.',
  INSUFFICIENT_STOCK: 'Insufficient stock for one or more items in your order.',
  CANCEL_NOT_ALLOWED: 'This order can no longer be cancelled.',
  PRODUCT_UNAVAILABLE: 'One or more products in your cart are no longer available.',
  DUPLICATE_CHECKOUT: 'A checkout is already in progress. Please wait and try again.',
} as const;

/**
 * Explicit allowed-transition map (IMPLEMENTATION_PLAN.md M9 — "validated
 * against an explicit allowed-transition map in the service layer, not
 * left to schema-level enum validation alone"). Any pair not listed here
 * (e.g. DELIVERED → PENDING, per API_BLUEPRINT.md §9's own example) is
 * rejected with 409 Conflict.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

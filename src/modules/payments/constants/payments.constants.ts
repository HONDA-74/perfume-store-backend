/**
 * Payments module — module-scoped constants (AI_RULES.md §35).
 * Kept inside `modules/payments/constants/`, not `common/`, since these are
 * feature-specific (SYSTEM_ARCHITECTURE.md §6.2).
 */

/**
 * Payment provider identifiers. Stripe is the sole provider for M12;
 * additional providers (Paymob, PayPal, etc.) can be added as enum members
 * in the future without changing the schema.
 */
export enum PaymentProvider {
  STRIPE = 'STRIPE',
}

/**
 * Fine-grained lifecycle status of a Payment entity.
 *
 * Distinct from the order-level `PaymentStatus` enum (common/types/enums)
 * which only exposes UNPAID | PAID | REFUNDED. This enum lives in the
 * payments module because only PaymentsService produces/consumes it.
 * If a second module ever needs it, it will be promoted to `common/`.
 *
 * Mapping to order-level PaymentStatus:
 *   SUCCEEDED → PAID
 *   REFUNDED  → REFUNDED
 *   everything else → UNPAID (order has not been paid yet)
 */
export enum PaymentEntityStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

export const PAYMENT_MESSAGES = {
  NOT_FOUND: 'Payment not found.',
  ORDER_NOT_FOUND: 'Order not found.',
  INTENT_FAILED: 'Failed to create Stripe PaymentIntent.',
  REFUND_FAILED: 'Failed to process refund.',
  WEBHOOK_INVALID: 'Webhook signature verification failed.',
  ALREADY_REFUNDED: 'This payment has already been refunded.',
  NOT_SUCCEEDED: 'Only succeeded payments can be refunded.',
  STRIPE_NOT_CONFIGURED: 'Stripe is not configured in this environment.',
  DUPLICATE_EVENT: 'Webhook event already processed.',
} as const;

/**
 * Stripe event types handled by PaymentsService (IMPLEMENTATION_PLAN.md M12).
 * Typed as const strings rather than referencing the Stripe SDK types so the
 * constants module stays decoupled from the SDK import graph.
 */
export const STRIPE_EVENTS = {
  PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
  PAYMENT_INTENT_PAYMENT_FAILED: 'payment_intent.payment_failed',
  CHARGE_REFUNDED: 'charge.refunded',
} as const;

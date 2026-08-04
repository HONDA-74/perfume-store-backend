import Stripe from 'stripe';

/**
 * Constructs and verifies a Stripe webhook event from a raw request body
 * and the `stripe-signature` header.
 *
 * WHY this util exists: Stripe signature verification MUST operate on the
 * raw body bytes before any JSON parsing. This helper is a thin wrapper
 * around `stripe.webhooks.constructEvent` so that:
 *  1. The actual Stripe SDK call is isolated to one place (easy to mock in tests).
 *  2. PaymentsService has no direct Stripe SDK import beyond this utility
 *     (separation of concerns; stripe client is passed in as a parameter).
 *  3. Errors from an invalid signature are thrown as-is and caught by the
 *     controller, which maps them to 400.
 *
 * @throws {Stripe.errors.StripeSignatureVerificationError} if the signature is invalid
 */
export function constructStripeEvent(
  stripe: Stripe,
  rawBody: Buffer,
  signature: string,
  webhookSecret: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

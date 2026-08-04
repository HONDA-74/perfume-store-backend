import { registerAs } from '@nestjs/config';

/**
 * Stripe payment gateway configuration (IMPLEMENTATION_PLAN.md M12).
 * All three variables are optional at startup — PaymentsService will
 * throw a clear runtime error if they are missing when called, keeping
 * boot behaviour consistent with the AI module (gemini.config.ts pattern).
 *
 * STRIPE_SECRET_KEY     — server-side API key (sk_test_* / sk_live_*)
 * STRIPE_WEBHOOK_SECRET — endpoint signing secret (whsec_*)
 * STRIPE_PUBLISHABLE_KEY — front-end public key (pk_test_* / pk_live_*)
 */
export default registerAs('stripe', () => ({
  secretKey: process.env.STRIPE_SECRET_KEY ?? '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
}));

import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import Stripe from 'stripe';
import { PaymentStatus } from '../../../common/types/enums/payment-status.enum';
import { OrdersService } from '../../orders/services/orders.service';
import {
  PAYMENT_MESSAGES,
  PaymentEntityStatus,
  PaymentProvider,
  STRIPE_EVENTS,
} from '../constants/payments.constants';
import { CreatePaymentIntentDto } from '../dto/create-payment-intent.dto';
import { PaymentIntentResponseDto } from '../dto/payment-intent-response.dto';
import { PaymentResponseDto } from '../dto/payment-response.dto';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { constructStripeEvent } from '../utils/stripe.util';

/**
 * Business logic for the Payments module (IMPLEMENTATION_PLAN.md M12).
 *
 * Dependency direction:
 *   PaymentsService → OrdersService (via injected service, no schema import)
 *   OrdersService   ← never depends on Payments
 *
 * This service is the ONLY place in the codebase that imports the Stripe SDK.
 * All cross-module state changes (order payment status) happen through the
 * three public methods exposed by OrdersService: markAsPaid(), markAsPaymentFailed(),
 * markAsRefunded() — never by importing the Order schema directly.
 *
 * Stripe key validation: if `STRIPE_SECRET_KEY` is absent (development/test
 * environments), every method that contacts Stripe throws a 500 with a clear
 * message rather than crashing at startup (consistent with AI module pattern).
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe | null;
  private readonly webhookSecret: string;

  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService,
  ) {
    const secretKey = this.configService.get<string>('stripe.secretKey', '');
    this.webhookSecret = this.configService.get<string>('stripe.webhookSecret', '');

    if (secretKey) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2025-01-27.acacia' as any });
    } else {
      this.stripe = null;
      this.logger.warn(
        'STRIPE_SECRET_KEY is not set — PaymentsService will reject all calls that contact Stripe.',
      );
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Creates a Stripe PaymentIntent for the given order.
   *
   * Flow:
   *  1. Resolve the order via OrdersService.findOrderForPayment() to get
   *     the authoritative total (never trust a client-supplied amount).
   *  2. Create the PaymentIntent on Stripe.
   *  3. Persist a Payment record in PENDING status for audit purposes.
   *  4. Return clientSecret + paymentIntentId to the client.
   *
   * Idempotency: if a PENDING payment already exists for this order, return
   * the existing paymentIntentId (prevents double-charging on retry).
   */
  async createIntent(
    userId: string,
    dto: CreatePaymentIntentDto,
  ): Promise<PaymentIntentResponseDto> {
    this.assertStripeConfigured();

    const requestId = `${userId}-${dto.orderId}-${Date.now()}`;
    const start = Date.now();

    this.logger.log(
      `[${requestId}] createIntent started — orderId=${dto.orderId} userId=${userId}`,
    );

    // Resolve order amount via service — never trust the client body.
    const orderTotal = await this.ordersService.findOrderTotalForPayment(dto.orderId, userId);

    const currency = dto.currency?.toLowerCase() ?? 'usd';

    // Amount in smallest currency unit (cents for USD).
    const amountInCents = Math.round(orderTotal * 100);

    // Idempotency check — return existing intent if one already exists.
    const existing = await this.paymentModel
      .findOne({ orderId: dto.orderId, status: PaymentEntityStatus.PENDING })
      .exec();

    if (existing) {
      this.logger.log(
        `[${requestId}] Returning existing PENDING intent (paymentIntentId=${existing.paymentIntentId})`,
      );
      return {
        clientSecret: await this.retrieveClientSecret(existing.paymentIntentId),
        paymentIntentId: existing.paymentIntentId,
        amount: existing.amount,
        currency: existing.currency,
      };
    }

    let intent: Stripe.PaymentIntent;
    try {
      intent = await this.stripe!.paymentIntents.create(
        {
          amount: amountInCents,
          currency,
          metadata: { orderId: dto.orderId, userId },
        },
        {
          idempotencyKey: `order-${dto.orderId}`,
        },
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[${requestId}] Stripe PaymentIntent creation failed — ${err.message}`,
        err.stack,
      );
      throw new InternalServerErrorException(PAYMENT_MESSAGES.INTENT_FAILED);
    }

    // Persist payment record for audit/idempotency.
    await this.paymentModel.create({
      orderId: dto.orderId,
      userId,
      paymentIntentId: intent.id,
      provider: PaymentProvider.STRIPE,
      status: PaymentEntityStatus.PENDING,
      currency,
      amount: amountInCents,
    });

    const latency = Date.now() - start;
    this.logger.log(
      `[${requestId}] createIntent succeeded — paymentIntentId=${intent.id} ` +
        `amount=${amountInCents} currency=${currency} latency=${latency}ms`,
    );

    return {
      clientSecret: intent.client_secret!,
      paymentIntentId: intent.id,
      amount: amountInCents,
      currency,
    };
  }

  /**
   * Processes an incoming Stripe webhook event.
   *
   * Security:
   *  - Signature verified via `stripe.webhooks.constructEvent` using the raw
   *    body bytes (never parsed JSON — the signature covers the raw payload).
   *  - Idempotency: each event is identified by `paymentIntentId`; if the
   *    payment record already shows the terminal state, the event is a no-op.
   *
   * Handled events:
   *  - payment_intent.succeeded  → SUCCEEDED, mark order as PAID
   *  - payment_intent.payment_failed → FAILED, mark order as payment-failed
   *  - charge.refunded           → REFUNDED, mark order as refunded
   */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    if (!this.webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET is not configured — rejecting webhook');
      throw new BadRequestException(PAYMENT_MESSAGES.STRIPE_NOT_CONFIGURED);
    }

    let event: Stripe.Event;
    try {
      event = constructStripeEvent(this.stripe!, rawBody, signature, this.webhookSecret);
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Webhook signature verification failed — ${err.message}`);
      throw new BadRequestException(PAYMENT_MESSAGES.WEBHOOK_INVALID);
    }

    this.logger.log(`Webhook received — type=${event.type} id=${event.id}`);

    switch (event.type) {
      case STRIPE_EVENTS.PAYMENT_INTENT_SUCCEEDED:
        await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case STRIPE_EVENTS.PAYMENT_INTENT_PAYMENT_FAILED:
        await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case STRIPE_EVENTS.CHARGE_REFUNDED:
        await this.handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      default:
        this.logger.log(`Webhook event unhandled — type=${event.type}`);
    }
  }

  /**
   * Issues a Stripe refund for the payment associated with the given order.
   *
   * Flow:
   *  1. Locate the Payment record by orderId.
   *  2. Assert it is in SUCCEEDED status.
   *  3. Call Stripe Refunds API.
   *  4. Update Payment to REFUNDED.
   *  5. Update Order status via OrdersService.markAsRefunded().
   */
  async refund(orderId: string): Promise<PaymentResponseDto> {
    this.assertStripeConfigured();

    const start = Date.now();
    this.logger.log(`refund started — orderId=${orderId}`);

    const payment = await this.paymentModel.findOne({ orderId }).exec();

    if (!payment) {
      throw new NotFoundException(PAYMENT_MESSAGES.NOT_FOUND);
    }

    if (payment.status === PaymentEntityStatus.REFUNDED) {
      throw new ConflictException(PAYMENT_MESSAGES.ALREADY_REFUNDED);
    }

    if (payment.status !== PaymentEntityStatus.SUCCEEDED) {
      throw new ConflictException(PAYMENT_MESSAGES.NOT_SUCCEEDED);
    }

    const session = await this.connection.startSession();

    try {
      let updatedPayment: PaymentDocument | undefined;

      try {
        await session.withTransaction(async () => {
          // Create the refund on Stripe.
          try {
            await this.stripe!.refunds.create({
              payment_intent: payment.paymentIntentId,
              metadata: { orderId, reason: 'admin_initiated' },
            });
          } catch (error) {
            const err = error as Error;
            this.logger.error(`Stripe refund API failed — ${err.message}`, err.stack);
            throw new InternalServerErrorException(PAYMENT_MESSAGES.REFUND_FAILED);
          }

          // Update the Payment record.
          payment.status = PaymentEntityStatus.REFUNDED;
          payment.refundedAt = new Date();
          await payment.save({ session });
          updatedPayment = payment;

          // Update the Order via service method (no schema import).
          await this.ordersService.markAsRefunded(orderId);
        });
      } catch (txError) {
        const txErr = txError as Error & { codeName?: string; message?: string };
        if (
          txErr.codeName === 'IllegalOperation' ||
          (typeof txErr.message === 'string' &&
            txErr.message.includes('Transaction numbers are only allowed'))
        ) {
          // Standalone MongoDB fallback (dev/CI without replica set).
          this.logger.warn('MongoDB replica set unavailable — refunding without transaction');
          await this.stripe!.refunds.create({ payment_intent: payment.paymentIntentId });
          payment.status = PaymentEntityStatus.REFUNDED;
          payment.refundedAt = new Date();
          await payment.save();
          updatedPayment = payment;
          await this.ordersService.markAsRefunded(orderId);
        } else {
          throw txError;
        }
      }

      if (!updatedPayment) {
        throw new Error('Refund completed but payment document was not updated.');
      }

      const latency = Date.now() - start;
      this.logger.log(
        `refund succeeded — orderId=${orderId} paymentIntentId=${payment.paymentIntentId} latency=${latency}ms`,
      );

      return PaymentResponseDto.fromEntity(updatedPayment);
    } finally {
      await session.endSession();
    }
  }

  // ── Private webhook handlers ──────────────────────────────────────────────

  private async handlePaymentSucceeded(intent: Stripe.PaymentIntent): Promise<void> {
    const { id: paymentIntentId, metadata, latest_charge } = intent;
    const orderId = metadata?.orderId;
    const chargeId =
      typeof latest_charge === 'string' ? latest_charge : (latest_charge?.id ?? null);

    const start = Date.now();
    this.logger.log(
      `handlePaymentSucceeded — paymentIntentId=${paymentIntentId} orderId=${orderId}`,
    );

    const payment = await this.paymentModel.findOne({ paymentIntentId }).exec();

    if (!payment) {
      this.logger.warn(
        `handlePaymentSucceeded — no Payment record found for paymentIntentId=${paymentIntentId}`,
      );
      return;
    }

    // Idempotency guard — already processed.
    if (payment.status === PaymentEntityStatus.SUCCEEDED) {
      this.logger.log(`handlePaymentSucceeded — duplicate event, already SUCCEEDED (skipped)`);
      return;
    }

    payment.status = PaymentEntityStatus.SUCCEEDED;
    payment.transactionId = chargeId;
    await payment.save();

    if (orderId) {
      await this.ordersService.markAsPaid(orderId, PaymentStatus.PAID);
    }

    const latency = Date.now() - start;
    this.logger.log(
      `handlePaymentSucceeded complete — orderId=${orderId} latency=${latency}ms provider=STRIPE status=SUCCEEDED`,
    );
  }

  private async handlePaymentFailed(intent: Stripe.PaymentIntent): Promise<void> {
    const { id: paymentIntentId, metadata, last_payment_error } = intent;
    const orderId = metadata?.orderId;
    const reason = last_payment_error?.message ?? 'Payment failed';

    this.logger.log(
      `handlePaymentFailed — paymentIntentId=${paymentIntentId} orderId=${orderId} reason="${reason}"`,
    );

    const payment = await this.paymentModel.findOne({ paymentIntentId }).exec();

    if (!payment) {
      this.logger.warn(
        `handlePaymentFailed — no Payment record found for paymentIntentId=${paymentIntentId}`,
      );
      return;
    }

    if (payment.status === PaymentEntityStatus.FAILED) {
      this.logger.log(`handlePaymentFailed — duplicate event, already FAILED (skipped)`);
      return;
    }

    payment.status = PaymentEntityStatus.FAILED;
    payment.failureReason = reason;
    await payment.save();

    if (orderId) {
      await this.ordersService.markAsPaymentFailed(orderId);
    }

    this.logger.log(
      `handlePaymentFailed complete — orderId=${orderId} provider=STRIPE status=FAILED`,
    );
  }

  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    const paymentIntentId =
      typeof charge.payment_intent === 'string' ? charge.payment_intent : null;

    this.logger.log(
      `handleChargeRefunded — paymentIntentId=${paymentIntentId} chargeId=${charge.id}`,
    );

    if (!paymentIntentId) {
      this.logger.warn('handleChargeRefunded — charge has no payment_intent (skipped)');
      return;
    }

    const payment = await this.paymentModel.findOne({ paymentIntentId }).exec();

    if (!payment) {
      this.logger.warn(
        `handleChargeRefunded — no Payment record for paymentIntentId=${paymentIntentId}`,
      );
      return;
    }

    if (payment.status === PaymentEntityStatus.REFUNDED) {
      this.logger.log(`handleChargeRefunded — duplicate event, already REFUNDED (skipped)`);
      return;
    }

    payment.status = PaymentEntityStatus.REFUNDED;
    payment.refundedAt = new Date();
    await payment.save();

    const orderId = payment.orderId.toString();
    await this.ordersService.markAsRefunded(orderId);

    this.logger.log(
      `handleChargeRefunded complete — orderId=${orderId} provider=STRIPE status=REFUNDED`,
    );
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private assertStripeConfigured(): void {
    if (!this.stripe) {
      throw new InternalServerErrorException(PAYMENT_MESSAGES.STRIPE_NOT_CONFIGURED);
    }
  }

  private async retrieveClientSecret(paymentIntentId: string): Promise<string> {
    const intent = await this.stripe!.paymentIntents.retrieve(paymentIntentId);
    return intent.client_secret!;
  }
}

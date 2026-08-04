import { ApiProperty } from '@nestjs/swagger';

/**
 * Response shape for POST /payments/create-intent.
 *
 * The client uses `clientSecret` to call `stripe.confirmCardPayment()` on the
 * front end. `paymentIntentId` is returned for logging/tracking only.
 */
export class PaymentIntentResponseDto {
  @ApiProperty({
    example: 'pi_3ABC123_secret_xyz',
    description: 'Stripe client secret — passed to stripe.js on the front end.',
  })
  clientSecret!: string;

  @ApiProperty({
    example: 'pi_3ABC123',
    description: 'Stripe PaymentIntent ID (pi_*).',
  })
  paymentIntentId!: string;

  @ApiProperty({
    example: 24000,
    description: 'Amount in the smallest currency unit (e.g. cents for USD).',
  })
  amount!: number;

  @ApiProperty({
    example: 'usd',
    description: 'ISO 4217 currency code (lowercase).',
  })
  currency!: string;
}

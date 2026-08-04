import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../../../common/pipes/parse-object-id.pipe';
import { Role } from '../../../common/types/enums/role.enum';
import { CreatePaymentIntentDto } from '../dto/create-payment-intent.dto';
import { PaymentIntentResponseDto } from '../dto/payment-intent-response.dto';
import { PaymentResponseDto } from '../dto/payment-response.dto';
import { PaymentsService } from '../services/payments.service';

/**
 * Payments endpoints (IMPLEMENTATION_PLAN.md M12).
 *
 * Auth posture:
 * - `POST /create-intent`: Customer only.
 * - `POST /refund/:orderId`: Admin only.
 * - `POST /webhook`: Public (verified via Stripe signature).
 */
@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent')
  @Roles(Role.CUSTOMER)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a Stripe PaymentIntent for an order (Customer only)' })
  @ApiCreatedResponse({ description: 'PaymentIntent created.', type: PaymentIntentResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  createIntent(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePaymentIntentDto,
  ): Promise<PaymentIntentResponseDto> {
    return this.paymentsService.createIntent(userId, dto);
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint (Public)' })
  @ApiOkResponse({ description: 'Webhook processed successfully.' })
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<void> {
    // req.rawBody is populated by the raw body middleware configured in main.ts
    // specifically for this route. Stripe signature verification requires the raw
    // unparsed buffer.
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new Error('Raw body is missing. Ensure the raw body middleware is configured.');
    }
    await this.paymentsService.handleWebhook(rawBody, signature);
  }

  @Post('refund/:orderId')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refund a payment for an order (Admin only)' })
  @ApiParam({ name: 'orderId', description: 'Mongo ObjectId of the order to refund.' })
  @ApiOkResponse({ description: 'Refund processed successfully.', type: PaymentResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  refund(@Param('orderId', ParseObjectIdPipe) orderId: string): Promise<PaymentResponseDto> {
    return this.paymentsService.refund(orderId);
  }
}

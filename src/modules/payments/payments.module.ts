import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsController } from './controllers/payments.controller';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { PaymentsService } from './services/payments.service';

/**
 * PaymentsModule — full implementation (IMPLEMENTATION_PLAN.md M12).
 *
 * Depends on OrdersModule for interacting with order status (markAsPaid, etc).
 * No circular dependency because OrdersModule does not depend on PaymentsModule.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    OrdersModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}

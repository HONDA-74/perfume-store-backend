import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CartModule } from '../cart/cart.module';
import { ProductsModule } from '../products/products.module';
import { UsersModule } from '../users/users.module';
import { OrdersController } from './controllers/orders.controller';
import { Order, OrderSchema } from './schemas/order.schema';
import { OrdersService } from './services/orders.service';

/**
 * OrdersModule — full implementation (IMPLEMENTATION_PLAN.md M9).
 *
 * Depends on Cart, Products, and Users (all exported services, never their
 * schemas) per SYSTEM_ARCHITECTURE.md §4.2 ("Orders: Cart, Products,
 * Users"). Orders sits at the top of the dependency chain — nothing in
 * this module ever imports itself back, and no circular dependency exists
 * (Cart/Products/Users never import Orders).
 *
 * `MongooseModule.forFeature` registers only the Orders schema here.
 * The default Mongoose connection (registered by DatabaseModule via
 * MongooseModule.forRootAsync) is automatically made available through
 * `@InjectConnection()` in OrdersService — no extra provider is needed.
 * This gives OrdersService.create() access to `connection.startSession()`
 * for the checkout ACID transaction without importing any external schema.
 *
 * `OrdersService` is exported so the future Coupons/Payments/Notifications
 * modules can inject it later — never the reverse.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    CartModule,
    ProductsModule,
    UsersModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

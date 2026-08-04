import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsModule } from '../products/products.module';
import { CartController } from './controllers/cart.controller';
import { Cart, CartSchema } from './schemas/cart.schema';
import { CartService } from './services/cart.service';

/**
 * CartModule — full implementation (IMPLEMENTATION_PLAN.md M7).
 *
 * Depends on ProductsModule (exported service, never its schema) per
 * SYSTEM_ARCHITECTURE.md §4.2 ("Cart: Products, Users"). Does not import
 * UsersModule — see CartService's doc comment for why that dependency
 * isn't needed. Must never import OrdersModule
 * (SYSTEM_ARCHITECTURE.md §4.2 "Cart: Must NOT Depend On: Orders").
 *
 * `CartService` is exported so that OrdersModule (M9) can inject it later
 * to read/clear the cart during checkout — never the reverse.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: Cart.name, schema: CartSchema }]), ProductsModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}

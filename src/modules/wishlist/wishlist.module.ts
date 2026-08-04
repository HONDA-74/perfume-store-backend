import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsModule } from '../products/products.module';
import { WishlistController } from './controllers/wishlist.controller';
import { Wishlist, WishlistSchema } from './schemas/wishlist.schema';
import { WishlistService } from './services/wishlist.service';

/**
 * WishlistModule — full implementation (IMPLEMENTATION_PLAN.md M8).
 *
 * Depends on ProductsModule (exported service, never its schema) per
 * SYSTEM_ARCHITECTURE.md §4.2 ("Wishlist: Products, Users"). Does not
 * import UsersModule — see WishlistService's doc comment for why that
 * dependency isn't needed. Must never import CartModule or OrdersModule
 * (SYSTEM_ARCHITECTURE.md §4.2 "Wishlist: Must NOT Depend On: Cart, Orders").
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Wishlist.name, schema: WishlistSchema }]),
    ProductsModule,
  ],
  controllers: [WishlistController],
  providers: [WishlistService],
  exports: [WishlistService],
})
export class WishlistModule {}

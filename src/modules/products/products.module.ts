import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BrandsModule } from '../brands/brands.module';
import { CategoriesModule } from '../categories/categories.module';
import { ProductsController } from './controllers/products.controller';
import { Product, ProductSchema } from './schemas/product.schema';
import { ProductsService } from './services/products.service';

/**
 * ProductsModule — full implementation (IMPLEMENTATION_PLAN.md M6).
 *
 * Depends on CategoriesModule and BrandsModule (both exported services,
 * never their schemas) per SYSTEM_ARCHITECTURE.md §4.2 ("Products:
 * Categories, Brands, Uploads"). Uploads (M5) is still a placeholder
 * module, so no UploadsService dependency exists yet — see
 * ProductsService's doc comment.
 *
 * `ProductsService` is exported so that Cart/Wishlist/Orders (M7-M9) can
 * inject it later — never the reverse (SYSTEM_ARCHITECTURE.md §4.2).
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    CategoriesModule,
    BrandsModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}

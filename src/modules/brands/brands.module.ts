import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BrandsController } from './controllers/brands.controller';
import { Brand, BrandSchema } from './schemas/brand.schema';
import { BrandsService } from './services/brands.service';

/**
 * BrandsModule — full implementation (IMPLEMENTATION_PLAN.md M4).
 *
 * Foundational leaf module per SYSTEM_ARCHITECTURE.md §4.2
 * ("Brands: Nothing (foundational) / Must NOT Depend On: Products,
 * Categories"). `BrandsService` is exported so that `ProductsModule`
 * (M6) can inject it later — never the reverse.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: Brand.name, schema: BrandSchema }])],
  controllers: [BrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}

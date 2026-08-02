import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoriesController } from './controllers/categories.controller';
import { Category, CategorySchema } from './schemas/category.schema';
import { CategoriesService } from './services/categories.service';

/**
 * CategoriesModule — full implementation (IMPLEMENTATION_PLAN.md M4).
 *
 * Foundational leaf module per SYSTEM_ARCHITECTURE.md §4.2
 * ("Categories: Nothing (foundational) / Must NOT Depend On: Products,
 * Brands"). `CategoriesService` is exported so that `ProductsModule`
 * (M6) can inject it later — never the reverse.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: Category.name, schema: CategorySchema }])],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}

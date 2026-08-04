import { Injectable } from '@nestjs/common';
import { ProductResponseDto } from '../../products/dto/product-response.dto';
import { ProductsService } from '../../products/services/products.service';
import { ExtractedPreferences } from '../interfaces/extracted-preferences.interface';

@Injectable()
export class ProductMatcherService {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * Never queries the Product schema/model directly — goes exclusively
   * through the exported ProductsService (SYSTEM_ARCHITECTURE.md §1.2/§4.3
   * — no cross-module schema imports). This is also the mechanism that
   * guarantees products are always read live rather than duplicated into
   * the vector store, per this milestone's explicit constraint.
   */
  async findMatchingProducts(
    preferences: ExtractedPreferences,
    topK: number,
  ): Promise<ProductResponseDto[]> {
    const result = await this.productsService.findAll({
      search: preferences.searchTerms,
      gender: preferences.gender,
      minPrice: preferences.minPrice,
      maxPrice: preferences.maxPrice,
      inStock: true,
      limit: topK,
      page: 1,
    });

    return result.items;
  }
}

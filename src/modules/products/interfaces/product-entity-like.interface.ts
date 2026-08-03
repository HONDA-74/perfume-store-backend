import { PerfumeGender } from '../../../common/types/enums/perfume-gender.enum';
import { ProductConcentration } from '../enums/product-concentration.enum';

export interface ProductNotesLike {
  top: string[];
  middle: string[];
  base: string[];
}

/**
 * Structural shape accepted by ProductResponseDto.fromEntity — matches both
 * a full Mongoose document (`.save()`/`.create()` results, exposing the
 * virtual `id` getter) and a `.lean()` plain object (only `_id`), mirroring
 * CategoryEntityLike/BrandEntityLike (categories/brands response DTOs).
 */
export interface ProductEntityLike {
  id?: string;
  _id?: { toString(): string };
  name: string;
  slug: string;
  sku: string;
  categoryId?: { toString(): string };
  brandId?: { toString(): string };
  description: string;
  price: number;
  discountPrice?: number;
  stockQuantity: number;
  gender: PerfumeGender;
  concentration?: ProductConcentration;
  sizeMl?: number;
  notes?: ProductNotesLike;
  images?: string[];
  isActive: boolean;
  isFeatured: boolean;
  ratingAverage: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

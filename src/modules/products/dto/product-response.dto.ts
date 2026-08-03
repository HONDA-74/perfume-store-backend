import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PerfumeGender } from '../../../common/types/enums/perfume-gender.enum';
import { ProductConcentration } from '../enums/product-concentration.enum';
import { ProductEntityLike } from '../interfaces/product-entity-like.interface';

export class ProductNotesResponseDto {
  @ApiProperty({ type: [String] })
  top!: string[];

  @ApiProperty({ type: [String] })
  middle!: string[];

  @ApiProperty({ type: [String] })
  base!: string[];
}

/**
 * No endpoint ever returns a raw Mongoose document (AI_RULES.md §11 DTO
 * Rules / SYSTEM_ARCHITECTURE.md §14 Data Exposure).
 */
export class ProductResponseDto {
  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c0d1' })
  id!: string;

  @ApiProperty({ example: 'Bleu de Chanel EDP' })
  name!: string;

  @ApiProperty({ example: 'bleu-de-chanel-edp' })
  slug!: string;

  @ApiProperty({ example: 'CHN-BLEU-EDP-100' })
  sku!: string;

  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c001' })
  categoryId!: string;

  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c002' })
  brandId!: string;

  @ApiProperty({ example: 'A woody aromatic fragrance with citrus top notes.' })
  description!: string;

  @ApiProperty({ example: 120 })
  price!: number;

  @ApiPropertyOptional({ example: 99.99 })
  discountPrice?: number;

  @ApiProperty({ example: 50 })
  stockQuantity!: number;

  @ApiProperty({ enum: PerfumeGender })
  gender!: PerfumeGender;

  @ApiPropertyOptional({ enum: ProductConcentration })
  concentration?: ProductConcentration;

  @ApiPropertyOptional({ example: 100 })
  sizeMl?: number;

  @ApiPropertyOptional({ type: ProductNotesResponseDto })
  notes?: ProductNotesResponseDto;

  @ApiProperty({ type: [String] })
  images!: string[];

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: false })
  isFeatured!: boolean;

  @ApiProperty({ example: 0 })
  ratingAverage!: number;

  @ApiProperty({ example: 0 })
  ratingCount!: number;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  updatedAt!: Date;

  static fromEntity(product: ProductEntityLike): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = product.id ?? product._id?.toString() ?? '';
    dto.name = product.name;
    dto.slug = product.slug;
    dto.sku = product.sku;
    dto.categoryId = product.categoryId?.toString() ?? '';
    dto.brandId = product.brandId?.toString() ?? '';
    dto.description = product.description;
    dto.price = product.price;
    dto.discountPrice = product.discountPrice;
    dto.stockQuantity = product.stockQuantity;
    dto.gender = product.gender;
    dto.concentration = product.concentration;
    dto.sizeMl = product.sizeMl;
    dto.notes = product.notes;
    dto.images = product.images ?? [];
    dto.isActive = product.isActive;
    dto.isFeatured = product.isFeatured;
    dto.ratingAverage = product.ratingAverage;
    dto.ratingCount = product.ratingCount;
    dto.createdAt = product.createdAt;
    dto.updatedAt = product.updatedAt;
    return dto;
  }
}

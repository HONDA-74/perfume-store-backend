import { ApiProperty } from '@nestjs/swagger';

/**
 * Structural shape accepted by `fromEntity` — matches both a full Mongoose
 * document (`.save()`/`.create()` results, which expose the virtual `id`
 * getter) and a `.lean()` plain object (which only has `_id`).
 */
interface CategoryEntityLike {
  id?: string;
  _id?: { toString(): string };
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * No endpoint ever returns a raw Mongoose document (AI_RULES.md §11 DTO
 * Rules / SYSTEM_ARCHITECTURE.md §14 Data Exposure).
 */
export class CategoryResponseDto {
  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c0d1' })
  id!: string;

  @ApiProperty({ example: 'Eau de Parfum' })
  name!: string;

  @ApiProperty({ example: 'eau-de-parfum' })
  slug!: string;

  @ApiProperty({ required: false, example: 'Long-lasting, concentrated fragrances.' })
  description?: string;

  @ApiProperty({ required: false, example: 'https://res.cloudinary.com/.../edp.jpg' })
  imageUrl?: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  updatedAt!: Date;

  static fromEntity(category: CategoryEntityLike): CategoryResponseDto {
    const dto = new CategoryResponseDto();
    dto.id = category.id ?? category._id?.toString() ?? '';
    dto.name = category.name;
    dto.slug = category.slug;
    dto.description = category.description;
    dto.imageUrl = category.imageUrl;
    dto.isActive = category.isActive;
    dto.createdAt = category.createdAt;
    dto.updatedAt = category.updatedAt;
    return dto;
  }
}

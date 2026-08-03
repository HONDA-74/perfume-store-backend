import { ApiProperty } from '@nestjs/swagger';

/**
 * Structural shape accepted by `fromEntity` — matches both a full Mongoose
 * document (`.save()`/`.create()` results, which expose the virtual `id`
 * getter) and a `.lean()` plain object (which only has `_id`).
 */
interface BrandEntityLike {
  id?: string;
  _id?: { toString(): string };
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  countryOfOrigin?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * No endpoint ever returns a raw Mongoose document (AI_RULES.md §11 DTO
 * Rules / SYSTEM_ARCHITECTURE.md §14 Data Exposure).
 */
export class BrandResponseDto {
  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c0d2' })
  id!: string;

  @ApiProperty({ example: 'Chanel' })
  name!: string;

  @ApiProperty({ example: 'chanel' })
  slug!: string;

  @ApiProperty({ required: false, example: 'French luxury fashion house founded in 1910.' })
  description?: string;

  @ApiProperty({ required: false, example: 'https://res.cloudinary.com/.../chanel-logo.jpg' })
  logoUrl?: string;

  @ApiProperty({ required: false, example: 'France' })
  countryOfOrigin?: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  updatedAt!: Date;

  static fromEntity(brand: BrandEntityLike): BrandResponseDto {
    const dto = new BrandResponseDto();
    dto.id = brand.id ?? brand._id?.toString() ?? '';
    dto.name = brand.name;
    dto.slug = brand.slug;
    dto.description = brand.description;
    dto.logoUrl = brand.logoUrl;
    dto.countryOfOrigin = brand.countryOfOrigin;
    dto.isActive = brand.isActive;
    dto.createdAt = brand.createdAt;
    dto.updatedAt = brand.updatedAt;
    return dto;
  }
}

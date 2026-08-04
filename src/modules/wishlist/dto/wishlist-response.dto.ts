import { ApiProperty } from '@nestjs/swagger';

/**
 * Structural shape accepted by the mapping below — matches an embedded
 * WishlistItem sub-document (productId is always a populated ObjectId with
 * a working `.toString()`).
 */
interface WishlistItemLike {
  productId: { toString(): string };
  addedAt: Date;
}

export class WishlistItemResponseDto {
  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c001' })
  productId!: string;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  addedAt!: Date;
}

/**
 * Structural shape accepted by `fromEntity` — matches a full Mongoose
 * document (`.save()`/`.create()` results, exposing the virtual `id`
 * getter), mirroring CartEntityLike (cart/dto/cart-response.dto.ts).
 */
interface WishlistEntityLike {
  id?: string;
  _id?: { toString(): string };
  userId: { toString(): string };
  items: WishlistItemLike[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * No endpoint ever returns a raw Mongoose document (AI_RULES.md §11 DTO
 * Rules / SYSTEM_ARCHITECTURE.md §14 Data Exposure).
 */
export class WishlistResponseDto {
  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c0d1' })
  id!: string;

  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c000' })
  userId!: string;

  @ApiProperty({ type: [WishlistItemResponseDto] })
  items!: WishlistItemResponseDto[];

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  updatedAt!: Date;

  static fromEntity(wishlist: WishlistEntityLike): WishlistResponseDto {
    const dto = new WishlistResponseDto();
    dto.id = wishlist.id ?? wishlist._id?.toString() ?? '';
    dto.userId = wishlist.userId?.toString() ?? '';
    dto.items = (wishlist.items ?? []).map((item) => ({
      productId: item.productId?.toString() ?? '',
      addedAt: item.addedAt,
    }));
    dto.createdAt = wishlist.createdAt;
    dto.updatedAt = wishlist.updatedAt;
    return dto;
  }
}

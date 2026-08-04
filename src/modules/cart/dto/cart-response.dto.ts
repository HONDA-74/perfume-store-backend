import { ApiProperty } from '@nestjs/swagger';

/**
 * Structural shape accepted by CartItemResponseDto's mapping — matches an
 * embedded CartItem sub-document (productId is always a populated ObjectId
 * with a working `.toString()`).
 */
interface CartItemLike {
  productId: { toString(): string };
  quantity: number;
  priceAtAdd: number;
}

export class CartItemResponseDto {
  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c001' })
  productId!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ example: 120, description: 'Snapshot price at time of add/update.' })
  priceAtAdd!: number;
}

/**
 * Structural shape accepted by `fromEntity` — matches a full Mongoose
 * document (`.save()`/`.create()` results, exposing the virtual `id`
 * getter), mirroring CategoryEntityLike/BrandEntityLike/ProductEntityLike.
 */
interface CartEntityLike {
  id?: string;
  _id?: { toString(): string };
  userId: { toString(): string };
  items: CartItemLike[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * No endpoint ever returns a raw Mongoose document (AI_RULES.md §11 DTO
 * Rules / SYSTEM_ARCHITECTURE.md §14 Data Exposure).
 */
export class CartResponseDto {
  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c0d1' })
  id!: string;

  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c000' })
  userId!: string;

  @ApiProperty({ type: [CartItemResponseDto] })
  items!: CartItemResponseDto[];

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  updatedAt!: Date;

  static fromEntity(cart: CartEntityLike): CartResponseDto {
    const dto = new CartResponseDto();
    dto.id = cart.id ?? cart._id?.toString() ?? '';
    dto.userId = cart.userId?.toString() ?? '';
    dto.items = (cart.items ?? []).map((item) => ({
      productId: item.productId?.toString() ?? '',
      quantity: item.quantity,
      priceAtAdd: item.priceAtAdd,
    }));
    dto.createdAt = cart.createdAt;
    dto.updatedAt = cart.updatedAt;
    return dto;
  }
}

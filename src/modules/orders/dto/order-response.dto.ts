import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../../../common/types/enums/order-status.enum';
import { PaymentStatus } from '../../../common/types/enums/payment-status.enum';
import {
  AddressSnapshotEntityLike,
  OrderEntityLike,
  OrderItemEntityLike,
} from '../interfaces/order-entity-like.interface';

export class OrderItemResponseDto {
  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c001' })
  productId!: string;

  @ApiProperty({ example: 'Bleu de Chanel EDP' })
  nameSnapshot!: string;

  @ApiProperty({ example: 120 })
  priceSnapshot!: number;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ example: 240 })
  lineTotal!: number;
}

export class AddressSnapshotResponseDto {
  @ApiPropertyOptional({ example: 'Home' })
  label?: string;

  @ApiProperty({ example: 'Jane Doe' })
  recipientName!: string;

  @ApiProperty({ example: '+201234567890' })
  phone!: string;

  @ApiProperty({ example: 'Egypt' })
  country!: string;

  @ApiProperty({ example: 'Tanta' })
  city!: string;

  @ApiProperty({ example: '12 Nile St.' })
  street!: string;

  @ApiPropertyOptional({ example: '31111' })
  postalCode?: string;
}

/**
 * No endpoint ever returns a raw Mongoose document (AI_RULES.md §11 DTO
 * Rules / SYSTEM_ARCHITECTURE.md §14 Data Exposure).
 */
export class OrderResponseDto {
  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c0d1' })
  id!: string;

  @ApiProperty({ example: 'ORD-2026-000123' })
  orderNumber!: string;

  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c000' })
  userId!: string;

  @ApiProperty({ type: [OrderItemResponseDto] })
  items!: OrderItemResponseDto[];

  @ApiProperty({ type: AddressSnapshotResponseDto })
  shippingAddress!: AddressSnapshotResponseDto;

  @ApiProperty({ example: 240 })
  subtotal!: number;

  @ApiProperty({ example: 0 })
  discountTotal!: number;

  @ApiProperty({ example: 0 })
  shippingFee!: number;

  @ApiProperty({ example: 240 })
  total!: number;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus!: PaymentStatus;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  placedAt!: Date;

  @ApiPropertyOptional({ example: null, nullable: true })
  cancelledAt?: Date | null;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  updatedAt!: Date;

  static fromEntity(order: OrderEntityLike): OrderResponseDto {
    const dto = new OrderResponseDto();
    dto.id = order.id ?? order._id?.toString() ?? '';
    dto.orderNumber = order.orderNumber;
    dto.userId = order.userId?.toString() ?? '';
    dto.items = order.items.map((item) => OrderResponseDto.mapItem(item));
    dto.shippingAddress = OrderResponseDto.mapAddress(order.shippingAddress);
    dto.subtotal = order.subtotal;
    dto.discountTotal = order.discountTotal;
    dto.shippingFee = order.shippingFee;
    dto.total = order.total;
    dto.status = order.status;
    dto.paymentStatus = order.paymentStatus;
    dto.placedAt = order.placedAt;
    dto.cancelledAt = order.cancelledAt ?? null;
    dto.createdAt = order.createdAt;
    dto.updatedAt = order.updatedAt;
    return dto;
  }

  private static mapItem(item: OrderItemEntityLike): OrderItemResponseDto {
    return {
      productId: item.productId?.toString() ?? '',
      nameSnapshot: item.nameSnapshot,
      priceSnapshot: item.priceSnapshot,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    };
  }

  private static mapAddress(address: AddressSnapshotEntityLike): AddressSnapshotResponseDto {
    return {
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      country: address.country,
      city: address.city,
      street: address.street,
      postalCode: address.postalCode,
    };
  }
}

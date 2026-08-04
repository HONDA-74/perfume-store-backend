import { OrderStatus } from '../../../common/types/enums/order-status.enum';
import { PaymentStatus } from '../../../common/types/enums/payment-status.enum';

export interface OrderItemEntityLike {
  productId: { toString(): string };
  nameSnapshot: string;
  priceSnapshot: number;
  quantity: number;
  lineTotal: number;
}

export interface AddressSnapshotEntityLike {
  label?: string;
  recipientName: string;
  phone: string;
  country: string;
  city: string;
  street: string;
  postalCode?: string;
  isDefault: boolean;
}

/**
 * Structural shape accepted by OrderResponseDto.fromEntity — matches both
 * a full Mongoose document (`.save()`/`.create()` results, exposing the
 * virtual `id` getter) and a `.lean()` plain object (only `_id`), mirroring
 * ProductEntityLike/CartEntityLike/WishlistEntityLike.
 */
export interface OrderEntityLike {
  id?: string;
  _id?: { toString(): string };
  orderNumber: string;
  userId: { toString(): string };
  items: OrderItemEntityLike[];
  shippingAddress: AddressSnapshotEntityLike;
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  placedAt: Date;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

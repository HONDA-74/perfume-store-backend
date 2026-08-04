import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { ProductsService } from '../../products/services/products.service';
import { CART_MESSAGES } from '../constants/cart.constants';
import { AddCartItemDto } from '../dto/add-cart-item.dto';
import { CartResponseDto } from '../dto/cart-response.dto';
import { UpdateCartItemDto } from '../dto/update-cart-item.dto';
import { Cart, CartDocument } from '../schemas/cart.schema';

/**
 * Business logic for the Cart module (IMPLEMENTATION_PLAN.md M7).
 *
 * Cart depends on Products (service-to-service only, per
 * SYSTEM_ARCHITECTURE.md §4.2 "Cart: Products, Users") to validate product
 * existence/status and re-check stock on every mutation — never imports the
 * Products schema directly (SYSTEM_ARCHITECTURE.md §1.2/§4.3).
 * `ProductsService.findOneByIdOrSlug` already enforces `isActive &&
 * !isDeleted`, so an inactive/soft-deleted product surfaces here as a
 * standard 404 with no extra logic needed.
 *
 * No dependency on UsersModule/UsersService is required — the caller's
 * identity arrives pre-verified as a userId string from the JWT payload
 * (via @CurrentUser('sub') in the controller); Cart never needs to read a
 * User document directly. This keeps Cart's dependency surface to exactly
 * Products, matching the documented direction.
 *
 * Cart intentionally does NOT depend on Orders (SYSTEM_ARCHITECTURE.md
 * §4.2 "Cart: Must NOT Depend On: Orders") — cart-to-order conversion is
 * Orders' (M9) responsibility, reading from CartService, never the reverse.
 */
@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    private readonly productsService: ProductsService,
  ) {}

  /**
   * Auto-creates an empty cart on first access (API_BLUEPRINT.md §7 —
   * "Auto-creates an empty cart on first access if none exists").
   */
  async getCart(userId: string): Promise<CartResponseDto> {
    const cart = await this.getOrCreateCartDocument(userId);
    return CartResponseDto.fromEntity(cart);
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<CartResponseDto> {
    const product = await this.productsService.findOneByIdOrSlug(dto.productId);
    const cart = await this.getOrCreateCartDocument(userId);

    const existingItem = cart.items.find((item) => item.productId.toString() === dto.productId);
    const requestedTotalQuantity = (existingItem?.quantity ?? 0) + dto.quantity;

    this.assertQuantityWithinStock(requestedTotalQuantity, product.stockQuantity);

    const effectivePrice = product.discountPrice ?? product.price;

    if (existingItem) {
      existingItem.quantity = requestedTotalQuantity;
      existingItem.priceAtAdd = effectivePrice;
    } else {
      cart.items.push({
        productId: product.id as unknown as CartDocument['items'][number]['productId'],
        quantity: dto.quantity,
        priceAtAdd: effectivePrice,
      } as CartDocument['items'][number]);
    }

    await cart.save();

    this.logger.log(`Cart item added (userId=${userId}, productId=${dto.productId})`);

    return CartResponseDto.fromEntity(cart);
  }

  async updateItem(
    userId: string,
    productId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    const cart = await this.getOrCreateCartDocument(userId);
    const item = cart.items.find((cartItem) => cartItem.productId.toString() === productId);

    if (!item) {
      throw new NotFoundException(CART_MESSAGES.ITEM_NOT_FOUND);
    }

    const product = await this.productsService.findOneByIdOrSlug(productId);
    this.assertQuantityWithinStock(dto.quantity, product.stockQuantity);

    item.quantity = dto.quantity;
    await cart.save();

    this.logger.log(`Cart item updated (userId=${userId}, productId=${productId})`);

    return CartResponseDto.fromEntity(cart);
  }

  async removeItem(userId: string, productId: string): Promise<CartResponseDto> {
    const cart = await this.getOrCreateCartDocument(userId);
    const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);

    if (itemIndex === -1) {
      throw new NotFoundException(CART_MESSAGES.ITEM_NOT_FOUND);
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();

    this.logger.log(`Cart item removed (userId=${userId}, productId=${productId})`);

    return CartResponseDto.fromEntity(cart);
  }

  /** Clears all items — a normal operation, not a soft/hard delete (DATABASE_DESIGN.md §6). */
  async clear(userId: string): Promise<void> {
    const cart = await this.getOrCreateCartDocument(userId);
    cart.items = [];
    await cart.save();

    this.logger.log(`Cart cleared (userId=${userId})`);
  }

  /**
   * Session-aware variant used exclusively by OrdersService during checkout
   * transactions. Clears the cart within the provided Mongoose ClientSession
   * so the write participates in the same ACID transaction as order creation
   * and stock decrements — preventing a crash from leaving the cart non-empty
   * after the order has already been committed.
   *
   * Uses findOneAndUpdate rather than document.save() so the session is
   * propagated correctly to the driver (Mongoose's save() does not reliably
   * accept a session on embedded-array mutations across all driver versions).
   */
  async clearWithSession(userId: string, session: ClientSession): Promise<void> {
    await this.cartModel.findOneAndUpdate({ userId }, { $set: { items: [] } }, { session }).exec();

    this.logger.log(`Cart cleared within transaction (userId=${userId})`);
  }

  /**
   * Returns the raw cart document (not a DTO) within the given session so
   * OrdersService can read the items as part of the checkout transaction.
   * The document is read with the session so it participates in the
   * snapshot-isolation guarantee MongoDB provides within a transaction.
   */
  async getCartDocumentForCheckout(
    userId: string,
    session: ClientSession,
  ): Promise<CartDocument | null> {
    return this.cartModel.findOne({ userId }).session(session).exec();
  }

  private async getOrCreateCartDocument(userId: string): Promise<CartDocument> {
    const existing = await this.cartModel.findOne({ userId }).exec();

    if (existing) {
      return existing;
    }

    return this.cartModel.create({ userId, items: [] });
  }

  private assertQuantityWithinStock(requestedQuantity: number, stockQuantity: number): void {
    if (requestedQuantity > stockQuantity) {
      throw new ConflictException(CART_MESSAGES.INSUFFICIENT_STOCK);
    }
  }
}

import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProductsService } from '../../products/services/products.service';
import { WISHLIST_MESSAGES } from '../constants/wishlist.constants';
import { WishlistResponseDto } from '../dto/wishlist-response.dto';
import { Wishlist, WishlistDocument } from '../schemas/wishlist.schema';

/**
 * Business logic for the Wishlist module (IMPLEMENTATION_PLAN.md M8).
 *
 * Wishlist depends on Products (service-to-service only, per
 * SYSTEM_ARCHITECTURE.md §4.2 "Wishlist: Products, Users") to validate
 * product existence before adding an item — never imports the Products
 * schema directly (SYSTEM_ARCHITECTURE.md §1.2/§4.3).
 * `ProductsService.findOneByIdOrSlug` already enforces `isActive &&
 * !isDeleted`, so a soft-deleted/inactive product surfaces here as a
 * standard 404 with no extra logic needed.
 *
 * No dependency on UsersModule/UsersService is required — same rationale
 * as CartService: the caller's identity arrives pre-verified as a userId
 * string from the JWT payload (@CurrentUser('sub') in the controller).
 *
 * Wishlist intentionally does NOT depend on Cart or Orders
 * (SYSTEM_ARCHITECTURE.md §4.2 "Wishlist: Must NOT Depend On: Cart, Orders").
 */
@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

  constructor(
    @InjectModel(Wishlist.name) private readonly wishlistModel: Model<WishlistDocument>,
    private readonly productsService: ProductsService,
  ) {}

  /**
   * Auto-creates an empty wishlist on first access (API_BLUEPRINT.md §8 —
   * "Auto-creates empty wishlist if none exists").
   */
  async getWishlist(userId: string): Promise<WishlistResponseDto> {
    const wishlist = await this.getOrCreateWishlistDocument(userId);
    return WishlistResponseDto.fromEntity(wishlist);
  }

  /**
   * 409 on duplicate is an explicit conflict, not a silent no-op
   * (API_BLUEPRINT.md §8 — "idempotent-friendly error, not silent no-op").
   */
  async addItem(userId: string, productId: string): Promise<WishlistResponseDto> {
    await this.productsService.findOneByIdOrSlug(productId);

    const wishlist = await this.getOrCreateWishlistDocument(userId);
    const alreadyPresent = wishlist.items.some((item) => item.productId.toString() === productId);

    if (alreadyPresent) {
      throw new ConflictException(WISHLIST_MESSAGES.ALREADY_IN_WISHLIST);
    }

    wishlist.items.push({
      productId,
      addedAt: new Date(),
    } as unknown as WishlistDocument['items'][number]);

    await wishlist.save();

    this.logger.log(`Wishlist item added (userId=${userId}, productId=${productId})`);

    return WishlistResponseDto.fromEntity(wishlist);
  }

  async removeItem(userId: string, productId: string): Promise<WishlistResponseDto> {
    const wishlist = await this.getOrCreateWishlistDocument(userId);
    const itemIndex = wishlist.items.findIndex((item) => item.productId.toString() === productId);

    if (itemIndex === -1) {
      throw new NotFoundException(WISHLIST_MESSAGES.ITEM_NOT_FOUND);
    }

    wishlist.items.splice(itemIndex, 1);
    await wishlist.save();

    this.logger.log(`Wishlist item removed (userId=${userId}, productId=${productId})`);

    return WishlistResponseDto.fromEntity(wishlist);
  }

  private async getOrCreateWishlistDocument(userId: string): Promise<WishlistDocument> {
    const existing = await this.wishlistModel.findOne({ userId }).exec();

    if (existing) {
      return existing;
    }

    return this.wishlistModel.create({ userId, items: [] });
  }
}

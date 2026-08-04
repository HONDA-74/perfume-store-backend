import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';
import { OrderStatus } from '../../../common/types/enums/order-status.enum';
import { PaymentStatus } from '../../../common/types/enums/payment-status.enum';
import { Role } from '../../../common/types/enums/role.enum';
import { PaginatedResult } from '../../../common/types/interfaces/paginated-result.interface';
import { buildPaginationMeta, normalizePagination } from '../../../common/utils/pagination.util';
import { CartService } from '../../cart/services/cart.service';
import { StockOperation } from '../../products/enums/stock-operation.enum';
import { ProductsService } from '../../products/services/products.service';
import { UsersService } from '../../users/services/users.service';
import { ORDER_MESSAGES, ORDER_STATUS_TRANSITIONS } from '../constants/orders.constants';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderResponseDto } from '../dto/order-response.dto';
import { QueryOrderDto } from '../dto/query-order.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { Order, OrderDocument } from '../schemas/order.schema';
import { generateOrderNumber } from '../utils/order-number.util';

/** Structural shape read off a hydrated User document's embedded addresses array. */
interface UserAddressLike {
  _id?: { toString(): string };
  id?: string;
  label?: string;
  recipientName: string;
  phone: string;
  country: string;
  city: string;
  street: string;
  postalCode?: string;
  isDefault: boolean;
}

interface DraftOrderItem {
  productId: string;
  nameSnapshot: string;
  priceSnapshot: number;
  quantity: number;
  lineTotal: number;
}

type AddressSnapshot = {
  label?: string;
  recipientName: string;
  phone: string;
  country: string;
  city: string;
  street: string;
  postalCode?: string;
  isDefault: boolean;
};

/**
 * Business logic for the Orders module (IMPLEMENTATION_PLAN.md M9).
 *
 * Orders sits at the top of the dependency chain (SYSTEM_ARCHITECTURE.md
 * §4.2 "Orders: Cart, Products, Users — Must NOT Depend On: —") — it may
 * depend on all three, and nothing may depend on it except the future
 * Coupons/Payments/Notifications modules. Every cross-module read goes
 * through an injected, exported service — never a schema/model import
 * (SYSTEM_ARCHITECTURE.md §1.2/§4.3).
 *
 * `InjectConnection` is injected here — not any external module's Model —
 * so that the checkout transaction can span multiple collections while
 * still calling each module's own service methods (with a passed session).
 * This is the standard @nestjs/mongoose multi-collection transaction pattern
 * and does not violate the cross-module schema isolation rule, since
 * `Connection` is owned by `@nestjs/mongoose`, not by any feature module.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    /*
     * WHY InjectConnection: MongoDB multi-document transactions require a
     * ClientSession that is tied to a specific Connection. We cannot get a
     * session from a Model; we must call connection.startSession(). This is
     * the canonical NestJS + Mongoose transaction pattern — injecting the
     * connection does NOT violate SYSTEM_ARCHITECTURE §1.2/§4.3 because
     * `Connection` belongs to @nestjs/mongoose, not to any feature module.
     */
    @InjectConnection() private readonly connection: Connection,
    private readonly cartService: CartService,
    private readonly productsService: ProductsService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * ACID checkout — the only method in the entire codebase that drives a
   * MongoDB multi-document transaction. Every step from inventory decrement
   * to order creation to cart clearing happens inside one session; if
   * anything fails, MongoDB rolls back all writes automatically.
   *
   * Sequence (IMPLEMENTATION_PLAN.md M9):
   *  1. Resolve and validate the shipping address (outside the transaction —
   *     this is a pure read of the User document and has no side effects).
   *  2. Start a MongoDB ClientSession and begin a transaction.
   *  3. Read the cart document inside the session (snapshot isolation).
   *  4. Guard: cart must be non-empty.
   *  5. For every cart item, re-fetch the product INSIDE the session to get
   *     the current price and verify it is still active.
   *  6. Attempt an atomic `$inc` DECREMENT with a `stockQuantity >= quantity`
   *     guard on every product — inside the session. If any decrement fails
   *     the guard (null return), the transaction aborts immediately.
   *  7. Create the order document inside the session.
   *  8. Clear the cart inside the session.
   *  9. Commit — all six writes land atomically or none do.
   *
   * Race-condition safety: two concurrent checkouts for the same last unit
   * both enter step 6, but MongoDB's atomic `$inc` with guard ensures only
   * one can satisfy `stockQuantity >= quantity`; the second gets null and
   * the transaction aborts, returning 409 to that caller. Inventory never
   * goes negative because the decrement and its guard are a single atomic
   * operation at the driver level.
   *
   * Duplicate checkout: the partial unique index on `{ userId, status:PENDING }`
   * (ORDER_SCHEMA) means that if two checkout requests race for the same user,
   * the second `orderModel.create` inside the session throws a MongoServerError
   * with code 11000, which is caught and surfaced as 409.
   */
  async create(userId: string, dto: CreateOrderDto): Promise<OrderResponseDto> {
    // Step 1 — resolve address before starting the transaction (read-only,
    // no side effects; keeping it outside the session reduces session hold time).
    const addressSnapshot = await this.resolveOwnedAddressSnapshot(userId, dto.addressId);

    this.logger.log(`Checkout started (userId=${userId})`);

    /*
     * Start a MongoDB session for ACID transaction support. On a standalone
     * MongoDB instance (local dev / CI without --replSet), sessions are
     * supported but multi-document transactions are not. We detect this at
     * runtime and fall back to the sequential non-transactional path, which
     * still provides atomic per-document stock decrements via $inc + guard
     * condition. In production (replica set / Atlas), the full transaction
     * path is always used.
     */
    const session = await this.connection.startSession();

    try {
      let createdOrder: OrderDocument | undefined;

      /*
       * withTransaction handles TransientTransactionError and
       * UnknownTransactionCommitResult retries automatically. On a standalone
       * MongoDB the session exists but transaction commands fail — we detect
       * that specific error and retry with the non-transactional path.
       */
      try {
        await session.withTransaction(async () => {
          const cartDoc = await this.cartService.getCartDocumentForCheckout(userId, session);
          if (!cartDoc || cartDoc.items.length === 0) {
            throw new BadRequestException(ORDER_MESSAGES.EMPTY_CART);
          }
          const { orderItems, subtotal } = await this.buildItemsAndDecrementStock(
            cartDoc.items.map((i) => ({ productId: i.productId.toString(), quantity: i.quantity })),
            session,
          );
          const orderNumber = await this.generateUniqueOrderNumber();
          const [order] = await this.orderModel.create(
            [
              {
                orderNumber,
                userId,
                items: orderItems,
                shippingAddress: addressSnapshot,
                subtotal,
                discountTotal: 0,
                shippingFee: 0,
                total: subtotal,
                status: OrderStatus.PENDING,
                paymentStatus: PaymentStatus.UNPAID,
                placedAt: new Date(),
              },
            ],
            { session },
          );
          createdOrder = order;
          await this.cartService.clearWithSession(userId, session);
        });
      } catch (txError) {
        const txErr = txError as Error & { code?: number; codeName?: string };
        // MongoServerError: 'Transaction numbers are only allowed on a replica
        // set member or mongos' — gracefully fall back to non-transactional
        // sequential checkout on standalone MongoDB (dev/test only).
        if (
          txErr.codeName === 'IllegalOperation' ||
          (typeof txErr.message === 'string' &&
            txErr.message.includes('Transaction numbers are only allowed'))
        ) {
          this.logger.warn(
            'MongoDB replica set unavailable — falling back to non-transactional checkout',
          );
          createdOrder = await this.checkoutWithoutTransaction(userId, addressSnapshot);
        } else {
          throw txError;
        }
      }

      if (!createdOrder) {
        throw new Error('Transaction completed but order document was not created.');
      }

      this.logger.log(
        `Checkout committed (userId=${userId}, orderNumber=${createdOrder.orderNumber}, id=${createdOrder.id})`,
      );

      return OrderResponseDto.fromEntity(createdOrder);
    } catch (error) {
      const err = error as Error & { code?: number };

      if (err.code === 11000) {
        this.logger.warn(`Duplicate checkout rejected (userId=${userId})`);
        throw new ConflictException(ORDER_MESSAGES.DUPLICATE_CHECKOUT);
      }

      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        this.logger.warn(`Checkout aborted (userId=${userId}, reason=${(error as Error).message})`);
        throw error;
      }

      this.logger.error(`Checkout transaction aborted (userId=${userId})`, (error as Error)?.stack);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Non-transactional checkout fallback used when MongoDB is running as a
   * standalone instance (no replica set — local dev and CI). Provides the
   * same stock-guard atomicity per document via $inc + filter condition, and
   * the same duplicate-checkout protection via the partial unique index on
   * { userId, status:PENDING }. The only difference from the transactional
   * path is the lack of all-or-nothing rollback across collections — if the
   * process crashes between stock decrement and order creation, a manual
   * reconciliation would be needed. In production (replica set), this path
   * is never reached.
   */
  private async checkoutWithoutTransaction(
    userId: string,
    addressSnapshot: AddressSnapshot,
  ): Promise<OrderDocument> {
    const cart = await this.cartService.getCart(userId);

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException(ORDER_MESSAGES.EMPTY_CART);
    }

    const orderItems: DraftOrderItem[] = [];
    let subtotal = 0;
    const decremented: Array<{ productId: string; quantity: number }> = [];

    try {
      for (const cartItem of cart.items) {
        const product = await this.productsService.findActiveProductForCheckout(
          cartItem.productId,
          null,
        );

        if (!product) {
          throw new NotFoundException(ORDER_MESSAGES.PRODUCT_UNAVAILABLE);
        }

        if (product.stockQuantity < cartItem.quantity) {
          throw new ConflictException(ORDER_MESSAGES.INSUFFICIENT_STOCK);
        }

        const updated = await this.productsService.decrementStockAtomic(
          cartItem.productId,
          cartItem.quantity,
          null,
        );

        if (!updated) {
          throw new ConflictException(ORDER_MESSAGES.INSUFFICIENT_STOCK);
        }

        decremented.push({ productId: cartItem.productId, quantity: cartItem.quantity });

        const priceSnapshot = product.discountPrice ?? product.price;
        const lineTotal = priceSnapshot * cartItem.quantity;
        orderItems.push({
          productId: product.id as string,
          nameSnapshot: product.name,
          priceSnapshot,
          quantity: cartItem.quantity,
          lineTotal,
        });
        subtotal += lineTotal;
      }

      const orderNumber = await this.generateUniqueOrderNumber();
      const [order] = await this.orderModel.create([
        {
          orderNumber,
          userId,
          items: orderItems,
          shippingAddress: addressSnapshot,
          subtotal,
          discountTotal: 0,
          shippingFee: 0,
          total: subtotal,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.UNPAID,
          placedAt: new Date(),
        },
      ]);

      await this.cartService.clear(userId);
      return order;
    } catch (error) {
      // Best-effort stock compensation on failure — same as the old
      // compensation pattern, used only on the non-transactional path.
      if (decremented.length > 0) {
        for (const item of decremented) {
          await this.productsService
            .updateStock(item.productId, {
              quantity: item.quantity,
              operation: StockOperation.INCREMENT,
            })
            .catch((compensationError: Error) => {
              this.logger.error(
                `Stock compensation failed (productId=${item.productId})`,
                compensationError?.stack,
              );
            });
        }
      }
      throw error;
    }
  }

  /**
   * Customer sees only own orders; Admin sees all, filterable by
   * `status`/`userId` (API_BLUEPRINT.md §9). Default sort: newest first
   * (API_BLUEPRINT.md §1.6/§31).
   */
  async findAll(
    callerId: string,
    callerRole: Role,
    query: QueryOrderDto,
  ): Promise<PaginatedResult<OrderResponseDto>> {
    const { page, limit, skip } = normalizePagination(query.page, query.limit);

    const filter: Record<string, unknown> = {};

    if (callerRole === Role.ADMIN) {
      if (query.userId) {
        filter.userId = query.userId;
      }
    } else {
      // Non-admin callers are always scoped to their own orders — any
      // userId supplied in the query is silently ignored, never trusted
      // from the request (AI_RULES.md §30).
      filter.userId = callerId;
    }

    if (query.status) {
      filter.status = query.status;
    }

    const [documents, totalItems] = await Promise.all([
      this.orderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    return {
      items: documents.map((doc) => OrderResponseDto.fromEntity(doc)),
      meta: buildPaginationMeta(page, limit, totalItems),
    };
  }

  /** 403 if a customer requests another customer's order (API_BLUEPRINT.md §9). */
  async findOne(callerId: string, callerRole: Role, id: string): Promise<OrderResponseDto> {
    const order = await this.orderModel.findById(id).exec();

    if (!order) {
      throw new NotFoundException(ORDER_MESSAGES.NOT_FOUND);
    }

    this.assertOwnershipOrAdmin(order, callerId, callerRole);

    return OrderResponseDto.fromEntity(order);
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<OrderResponseDto> {
    const order = await this.orderModel.findById(id).exec();

    if (!order) {
      throw new NotFoundException(ORDER_MESSAGES.NOT_FOUND);
    }

    this.assertValidTransition(order.status, dto.status);

    order.status = dto.status;
    if (dto.status === OrderStatus.CANCELLED) {
      order.cancelledAt = new Date();
    }

    await order.save();

    this.logger.log(`Order status updated (id=${order.id}, status=${dto.status})`);

    return OrderResponseDto.fromEntity(order);
  }

  /** Only allowed while `PENDING` or `CONFIRMED` (API_BLUEPRINT.md §9). */
  async cancel(userId: string, id: string): Promise<OrderResponseDto> {
    const order = await this.orderModel.findById(id).exec();

    if (!order) {
      throw new NotFoundException(ORDER_MESSAGES.NOT_FOUND);
    }

    if (order.userId.toString() !== userId) {
      throw new ForbiddenException(ORDER_MESSAGES.FORBIDDEN);
    }

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
      throw new ConflictException(ORDER_MESSAGES.CANCEL_NOT_ALLOWED);
    }

    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = new Date();
    await order.save();

    this.logger.log(`Order cancelled (id=${order.id}, userId=${userId})`);

    return OrderResponseDto.fromEntity(order);
  }

  // ── private helpers ──────────────────────────────────────────────────

  /**
   * Re-validates every cart item against live Product data inside the
   * transaction session, then atomically decrements stock for each one.
   *
   * WHY re-validate inside the transaction: the cart records `priceAtAdd`
   * from the moment the item was added, which may be stale. DATABASE_DESIGN
   * §4.7 defines `priceSnapshot` as "unit price at time of PURCHASE" — i.e.
   * the price at checkout, not at add-to-cart. Re-fetching inside the session
   * also catches products that became inactive or were soft-deleted after the
   * customer opened their cart.
   *
   * WHY atomic $inc with guard (not stock = stock - qty):
   *  - Read-then-write has a race window: two threads can both read stock=1,
   *    both pass the >=1 check, and both write stock=0, ending up at stock=-1.
   *  - A single `findOneAndUpdate` with `{ stockQuantity: { $gte: qty } }`
   *    in its filter makes the check and decrement one indivisible server-side
   *    operation. MongoDB's document-level locking guarantees that only one
   *    concurrent writer can win; the other gets null back.
   *  - Inside a transaction the session's snapshot further prevents another
   *    transaction from seeing the decremented value until this one commits.
   */
  private async buildItemsAndDecrementStock(
    cartItems: Array<{ productId: string; quantity: number }>,
    session: ClientSession,
  ): Promise<{ orderItems: DraftOrderItem[]; subtotal: number }> {
    const orderItems: DraftOrderItem[] = [];
    let subtotal = 0;

    for (const cartItem of cartItems) {
      // Re-fetch product inside the transaction for current price and
      // active/deleted status — never trust the cart's stale `priceAtAdd`.
      const product = await this.productsService.findActiveProductForCheckout(
        cartItem.productId,
        session,
      );

      if (!product) {
        this.logger.warn(
          `Checkout aborted — product unavailable (productId=${cartItem.productId})`,
        );
        throw new NotFoundException(ORDER_MESSAGES.PRODUCT_UNAVAILABLE);
      }

      // Pre-check: readable before attempting the atomic decrement so we
      // surface a clear stock-insufficient message rather than a generic null.
      if (product.stockQuantity < cartItem.quantity) {
        this.logger.warn(
          `Inventory conflict at checkout (productId=${cartItem.productId}, ` +
            `available=${product.stockQuantity}, requested=${cartItem.quantity})`,
        );
        throw new ConflictException(ORDER_MESSAGES.INSUFFICIENT_STOCK);
      }

      /*
       * WHY we call decrementStockAtomic even after the pre-check above:
       * the pre-check is NOT the authority — it is an optimistic fast-fail
       * that gives a descriptive error message when stock is clearly zero.
       * The actual authority is the atomic findOneAndUpdate with
       * stockQuantity >= qty in its filter, which runs at the MongoDB server
       * level. Two concurrent transactions can both pass the pre-check
       * (stock=1, both read 1 >= 1) but only one can win the atomic update.
       * The loser gets null, and we throw ConflictException.
       */
      const updated = await this.productsService.decrementStockAtomic(
        cartItem.productId,
        cartItem.quantity,
        session,
      );

      if (!updated) {
        // The atomic guard fired — another concurrent transaction beat this
        // one to the last unit. Throw to abort the transaction.
        this.logger.warn(
          `Inventory conflict — atomic decrement refused (productId=${cartItem.productId})`,
        );
        throw new ConflictException(ORDER_MESSAGES.INSUFFICIENT_STOCK);
      }

      // Use the CURRENT effective price (discountPrice ?? price) as the
      // snapshot — DATABASE_DESIGN §4.7 "unit price at time of purchase".
      const priceSnapshot = product.discountPrice ?? product.price;
      const lineTotal = priceSnapshot * cartItem.quantity;

      orderItems.push({
        productId: product.id as string,
        nameSnapshot: product.name,
        priceSnapshot,
        quantity: cartItem.quantity,
        lineTotal,
      });

      subtotal += lineTotal;
    }

    return { orderItems, subtotal };
  }

  private async resolveOwnedAddressSnapshot(
    userId: string,
    addressId: string,
  ): Promise<AddressSnapshot> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new BadRequestException(ORDER_MESSAGES.INVALID_ADDRESS);
    }

    const addresses = (user.addresses ?? []) as unknown as UserAddressLike[];
    const address = addresses.find(
      (candidate) => (candidate.id ?? candidate._id?.toString()) === addressId,
    );

    if (!address) {
      throw new BadRequestException(ORDER_MESSAGES.INVALID_ADDRESS);
    }

    return {
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      country: address.country,
      city: address.city,
      street: address.street,
      postalCode: address.postalCode,
      isDefault: address.isDefault,
    };
  }

  private async generateUniqueOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const startOfNextYear = new Date(year + 1, 0, 1);

    const MAX_ATTEMPTS = 5;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const countThisYear = await this.orderModel
        .countDocuments({ createdAt: { $gte: startOfYear, $lt: startOfNextYear } })
        .exec();

      const candidate = generateOrderNumber(countThisYear + 1 + attempt, year);
      const exists = await this.orderModel.exists({ orderNumber: candidate });

      if (!exists) {
        return candidate;
      }
    }

    // Extremely unlikely fallback — timestamp-suffixed to guarantee uniqueness.
    return generateOrderNumber(Date.now() % 1_000_000, year);
  }

  private assertOwnershipOrAdmin(order: OrderDocument, callerId: string, callerRole: Role): void {
    if (callerRole === Role.ADMIN) {
      return;
    }

    if (order.userId.toString() !== callerId) {
      throw new ForbiddenException(ORDER_MESSAGES.FORBIDDEN);
    }
  }

  private assertValidTransition(current: OrderStatus, next: OrderStatus): void {
    const allowed = ORDER_STATUS_TRANSITIONS[current] ?? [];

    if (!allowed.includes(next)) {
      throw new ConflictException(ORDER_MESSAGES.INVALID_STATUS_TRANSITION);
    }
  }
}

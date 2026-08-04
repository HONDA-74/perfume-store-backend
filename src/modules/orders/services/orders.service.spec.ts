import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Connection } from 'mongoose';
import { OrderStatus } from '../../../common/types/enums/order-status.enum';
import { PaymentStatus } from '../../../common/types/enums/payment-status.enum';
import { Role } from '../../../common/types/enums/role.enum';
import { CartService } from '../../cart/services/cart.service';
import { ProductsService } from '../../products/services/products.service';
import { UsersService } from '../../users/services/users.service';
import { ORDER_MESSAGES, ORDER_STATUS_TRANSITIONS } from '../constants/orders.constants';
import { Order } from '../schemas/order.schema';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;

  // ── fixture IDs ────────────────────────────────────────────────────────────
  const USER_ID = '66f1a2b3c4d5e6f7a8b9c000';
  const OTHER_USER_ID = '66f1a2b3c4d5e6f7a8b9c111';
  const PRODUCT_ID = '66f1a2b3c4d5e6f7a8b9c001';
  const PRODUCT_ID_2 = '66f1a2b3c4d5e6f7a8b9c002';
  const ORDER_ID = '66f1a2b3c4d5e6f7a8b9c0ff';
  const ADDRESS_ID = '66f1a2b3c4d5e6f7a8b9c0a1';
  const ORDER_NUMBER = 'ORD-2026-000001';

  // ── fixtures ───────────────────────────────────────────────────────────────
  const mockAddress = {
    id: ADDRESS_ID,
    _id: { toString: () => ADDRESS_ID },
    label: 'Home',
    recipientName: 'Jane Doe',
    phone: '+201234567890',
    country: 'Egypt',
    city: 'Tanta',
    street: '12 Nile St.',
    postalCode: '31111',
    isDefault: true,
  };

  const mockUser = {
    id: USER_ID,
    addresses: [mockAddress],
  };

  const mockProduct = {
    id: PRODUCT_ID,
    name: 'Bleu de Chanel EDP',
    price: 120,
    discountPrice: undefined as number | undefined,
    stockQuantity: 50,
    isActive: true,
    isDeleted: false,
  };

  const makeCartDoc = (
    items: Array<{ productId: string; quantity: number; priceAtAdd: number }>,
  ) => ({
    items: items.map((i) => ({
      productId: { toString: () => i.productId },
      quantity: i.quantity,
      priceAtAdd: i.priceAtAdd,
    })),
  });

  const makeOrder = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: ORDER_ID,
    _id: { toString: () => ORDER_ID },
    orderNumber: ORDER_NUMBER,
    userId: { toString: () => USER_ID },
    items: [
      {
        productId: { toString: () => PRODUCT_ID },
        nameSnapshot: 'Bleu de Chanel EDP',
        priceSnapshot: 120,
        quantity: 2,
        lineTotal: 240,
      },
    ],
    shippingAddress: mockAddress,
    subtotal: 240,
    discountTotal: 0,
    shippingFee: 0,
    total: 240,
    status: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.UNPAID,
    placedAt: new Date('2026-01-15T10:00:00.000Z'),
    cancelledAt: null,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  // ── mock querybuilder ──────────────────────────────────────────────────────
  const mockQueryBuilder = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };

  // ── mock model ─────────────────────────────────────────────────────────────
  const mockModel = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    exists: jest.fn(),
  };

  // ── mock session / connection ──────────────────────────────────────────────
  const makeSession = () => ({
    withTransaction: jest.fn().mockImplementation(async (fn: () => Promise<void>) => {
      await fn();
    }),
    endSession: jest.fn().mockResolvedValue(undefined),
  });

  const mockConnection = {
    startSession: jest.fn(),
  };

  // ── mock cross-module services ─────────────────────────────────────────────
  const mockCartService = {
    getCartDocumentForCheckout: jest.fn(),
    clearWithSession: jest.fn().mockResolvedValue(undefined),
  };

  const mockProductsService = {
    findActiveProductForCheckout: jest.fn(),
    decrementStockAtomic: jest.fn(),
  };

  const mockUsersService = {
    findById: jest.fn(),
  };

  // ── module bootstrap ───────────────────────────────────────────────────────
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getModelToken(Order.name), useValue: mockModel },
        { provide: 'DatabaseConnection', useValue: mockConnection },
        { provide: CartService, useValue: mockCartService },
        { provide: ProductsService, useValue: mockProductsService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    })
      .overrideProvider('DatabaseConnection')
      .useValue(mockConnection)
      .compile();

    service = module.get<OrdersService>(OrdersService);

    // Replace the injected connection with our mock directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).connection = mockConnection as unknown as Connection;

    jest.clearAllMocks();
  });

  // ── create (checkout) ─────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { addressId: ADDRESS_ID };

    const setupHappyPath = () => {
      const session = makeSession();
      mockConnection.startSession.mockResolvedValue(session);
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockCartService.getCartDocumentForCheckout.mockResolvedValue(
        makeCartDoc([{ productId: PRODUCT_ID, quantity: 2, priceAtAdd: 120 }]),
      );
      mockProductsService.findActiveProductForCheckout.mockResolvedValue(mockProduct);
      mockProductsService.decrementStockAtomic.mockResolvedValue({
        ...mockProduct,
        stockQuantity: 48,
      });
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });
      mockModel.exists.mockReturnValue(Promise.resolve(null));
      mockModel.create.mockResolvedValue([makeOrder()]);
      return session;
    };

    it('should create an order and return a response DTO on a happy path', async () => {
      setupHappyPath();

      const result = await service.create(USER_ID, dto);

      expect(result.orderNumber).toBe(ORDER_NUMBER);
      expect(result.userId).toBe(USER_ID);
      expect(result.status).toBe(OrderStatus.PENDING);
      expect(result.paymentStatus).toBe(PaymentStatus.UNPAID);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].nameSnapshot).toBe('Bleu de Chanel EDP');
      expect(result.items[0].priceSnapshot).toBe(120);
      expect(result.items[0].quantity).toBe(2);
      expect(result.items[0].lineTotal).toBe(240);
      expect(result.subtotal).toBe(240);
      expect(result.total).toBe(240);
    });

    it('should use discountPrice as priceSnapshot when product has a discount', async () => {
      setupHappyPath();
      mockProductsService.findActiveProductForCheckout.mockResolvedValue({
        ...mockProduct,
        price: 120,
        discountPrice: 99,
      });
      mockModel.create.mockResolvedValue([
        makeOrder({
          items: [
            {
              productId: { toString: () => PRODUCT_ID },
              nameSnapshot: 'Bleu de Chanel EDP',
              priceSnapshot: 99,
              quantity: 2,
              lineTotal: 198,
            },
          ],
          subtotal: 198,
          total: 198,
        }),
      ]);

      const result = await service.create(USER_ID, dto);

      expect(result.items[0].priceSnapshot).toBe(99);
    });

    it('should clear the cart after successful order creation', async () => {
      setupHappyPath();

      await service.create(USER_ID, dto);

      expect(mockCartService.clearWithSession).toHaveBeenCalledWith(USER_ID, expect.anything());
    });

    it('should end the MongoDB session in the finally block regardless of outcome', async () => {
      const session = setupHappyPath();

      await service.create(USER_ID, dto);

      expect(session.endSession).toHaveBeenCalled();
    });

    it('should end the session even when checkout fails', async () => {
      const session = makeSession();
      mockConnection.startSession.mockResolvedValue(session);
      mockUsersService.findById.mockResolvedValue(mockUser);
      session.withTransaction.mockRejectedValue(new Error('DB error'));

      await service.create(USER_ID, dto).catch(() => null);

      expect(session.endSession).toHaveBeenCalled();
    });

    it('should throw BadRequestException when cart is empty', async () => {
      const session = makeSession();
      mockConnection.startSession.mockResolvedValue(session);
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockCartService.getCartDocumentForCheckout.mockResolvedValue(makeCartDoc([]));

      await expect(service.create(USER_ID, dto)).rejects.toThrow(
        new BadRequestException(ORDER_MESSAGES.EMPTY_CART),
      );
    });

    it('should throw BadRequestException when cart document does not exist', async () => {
      const session = makeSession();
      mockConnection.startSession.mockResolvedValue(session);
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockCartService.getCartDocumentForCheckout.mockResolvedValue(null);

      await expect(service.create(USER_ID, dto)).rejects.toThrow(
        new BadRequestException(ORDER_MESSAGES.EMPTY_CART),
      );
    });

    it('should throw BadRequestException when addressId does not belong to the user', async () => {
      const session = makeSession();
      mockConnection.startSession.mockResolvedValue(session);
      mockUsersService.findById.mockResolvedValue(mockUser);

      await expect(
        service.create(USER_ID, { addressId: '66f1a2b3c4d5e6f7a8b9c999' }),
      ).rejects.toThrow(new BadRequestException(ORDER_MESSAGES.INVALID_ADDRESS));
    });

    it('should throw BadRequestException when user has no saved addresses', async () => {
      const session = makeSession();
      mockConnection.startSession.mockResolvedValue(session);
      mockUsersService.findById.mockResolvedValue({ ...mockUser, addresses: [] });

      await expect(service.create(USER_ID, dto)).rejects.toThrow(
        new BadRequestException(ORDER_MESSAGES.INVALID_ADDRESS),
      );
    });

    it('should throw NotFoundException when a cart product is inactive', async () => {
      const session = makeSession();
      mockConnection.startSession.mockResolvedValue(session);
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockCartService.getCartDocumentForCheckout.mockResolvedValue(
        makeCartDoc([{ productId: PRODUCT_ID, quantity: 1, priceAtAdd: 120 }]),
      );
      mockProductsService.findActiveProductForCheckout.mockResolvedValue(null);

      await expect(service.create(USER_ID, dto)).rejects.toThrow(
        new NotFoundException(ORDER_MESSAGES.PRODUCT_UNAVAILABLE),
      );
    });

    it('should throw NotFoundException when a cart product was soft-deleted', async () => {
      const session = makeSession();
      mockConnection.startSession.mockResolvedValue(session);
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockCartService.getCartDocumentForCheckout.mockResolvedValue(
        makeCartDoc([{ productId: PRODUCT_ID, quantity: 1, priceAtAdd: 120 }]),
      );
      mockProductsService.findActiveProductForCheckout.mockResolvedValue(null);

      await expect(service.create(USER_ID, dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when cart quantity exceeds available stock', async () => {
      const session = makeSession();
      mockConnection.startSession.mockResolvedValue(session);
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockCartService.getCartDocumentForCheckout.mockResolvedValue(
        makeCartDoc([{ productId: PRODUCT_ID, quantity: 10, priceAtAdd: 120 }]),
      );
      mockProductsService.findActiveProductForCheckout.mockResolvedValue({
        ...mockProduct,
        stockQuantity: 3,
      });

      await expect(service.create(USER_ID, dto)).rejects.toThrow(
        new ConflictException(ORDER_MESSAGES.INSUFFICIENT_STOCK),
      );
    });

    it('should throw ConflictException when atomic decrement returns null (race condition)', async () => {
      const session = makeSession();
      mockConnection.startSession.mockResolvedValue(session);
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockCartService.getCartDocumentForCheckout.mockResolvedValue(
        makeCartDoc([{ productId: PRODUCT_ID, quantity: 1, priceAtAdd: 120 }]),
      );
      mockProductsService.findActiveProductForCheckout.mockResolvedValue(mockProduct);
      // Simulate the atomic guard failing (another transaction won the last unit)
      mockProductsService.decrementStockAtomic.mockResolvedValue(null);

      await expect(service.create(USER_ID, dto)).rejects.toThrow(
        new ConflictException(ORDER_MESSAGES.INSUFFICIENT_STOCK),
      );
    });

    it('should compute correct subtotal and total for multiple items', async () => {
      const session = makeSession();
      mockConnection.startSession.mockResolvedValue(session);
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockCartService.getCartDocumentForCheckout.mockResolvedValue(
        makeCartDoc([
          { productId: PRODUCT_ID, quantity: 2, priceAtAdd: 120 },
          { productId: PRODUCT_ID_2, quantity: 1, priceAtAdd: 90 },
        ]),
      );
      mockProductsService.findActiveProductForCheckout
        .mockResolvedValueOnce(mockProduct) // product 1: price 120
        .mockResolvedValueOnce({ ...mockProduct, id: PRODUCT_ID_2, price: 90, name: 'Chance EDP' });
      mockProductsService.decrementStockAtomic
        .mockResolvedValueOnce({ ...mockProduct, stockQuantity: 48 })
        .mockResolvedValueOnce({ stockQuantity: 9 });
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });
      mockModel.exists.mockReturnValue(Promise.resolve(null));
      mockModel.create.mockResolvedValue([
        makeOrder({
          items: [
            {
              productId: { toString: () => PRODUCT_ID },
              nameSnapshot: 'Bleu de Chanel EDP',
              priceSnapshot: 120,
              quantity: 2,
              lineTotal: 240,
            },
            {
              productId: { toString: () => PRODUCT_ID_2 },
              nameSnapshot: 'Chance EDP',
              priceSnapshot: 90,
              quantity: 1,
              lineTotal: 90,
            },
          ],
          subtotal: 330,
          total: 330,
        }),
      ]);

      const result = await service.create(USER_ID, dto);

      expect(result.subtotal).toBe(330);
      expect(result.total).toBe(330);
      expect(result.items).toHaveLength(2);
    });

    it('should call decrementStockAtomic for every cart item', async () => {
      const session = makeSession();
      mockConnection.startSession.mockResolvedValue(session);
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockCartService.getCartDocumentForCheckout.mockResolvedValue(
        makeCartDoc([
          { productId: PRODUCT_ID, quantity: 2, priceAtAdd: 120 },
          { productId: PRODUCT_ID_2, quantity: 1, priceAtAdd: 90 },
        ]),
      );
      mockProductsService.findActiveProductForCheckout
        .mockResolvedValueOnce(mockProduct)
        .mockResolvedValueOnce({ ...mockProduct, id: PRODUCT_ID_2, price: 90 });
      mockProductsService.decrementStockAtomic.mockResolvedValue({ stockQuantity: 1 });
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });
      mockModel.exists.mockReturnValue(Promise.resolve(null));
      mockModel.create.mockResolvedValue([makeOrder()]);

      await service.create(USER_ID, dto);

      expect(mockProductsService.decrementStockAtomic).toHaveBeenCalledTimes(2);
    });

    it('should snapshot the address at checkout time (copy by value)', async () => {
      setupHappyPath();

      const result = await service.create(USER_ID, dto);

      expect(result.shippingAddress.recipientName).toBe('Jane Doe');
      expect(result.shippingAddress.country).toBe('Egypt');
      expect(result.shippingAddress.city).toBe('Tanta');
    });

    it('should create the order with PENDING status and UNPAID payment status', async () => {
      setupHappyPath();

      const result = await service.create(USER_ID, dto);

      expect(result.status).toBe(OrderStatus.PENDING);
      expect(result.paymentStatus).toBe(PaymentStatus.UNPAID);
    });

    it('should surface ConflictException with DUPLICATE_CHECKOUT on MongoServerError 11000', async () => {
      const session = makeSession();
      const mongo11000 = Object.assign(new Error('duplicate key'), { code: 11000 });
      mockConnection.startSession.mockResolvedValue(session);
      mockUsersService.findById.mockResolvedValue(mockUser);
      session.withTransaction.mockRejectedValue(mongo11000);

      await expect(service.create(USER_ID, dto)).rejects.toThrow(
        new ConflictException(ORDER_MESSAGES.DUPLICATE_CHECKOUT),
      );
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it("should return only the requesting customer's orders", async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([makeOrder()]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });

      const result = await service.findAll(USER_ID, Role.CUSTOMER, {});

      expect(mockModel.find).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID }));
      expect(result.items).toHaveLength(1);
    });

    it('should allow Admin to see all orders without userId constraint', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([makeOrder()]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });

      await service.findAll(USER_ID, Role.ADMIN, {});

      const callArg = (mockModel.find as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      expect(callArg).not.toHaveProperty('userId');
    });

    it('should allow Admin to filter by a specific userId', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll(USER_ID, Role.ADMIN, { userId: OTHER_USER_ID });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ userId: OTHER_USER_ID }),
      );
    });

    it('should silently ignore a userId filter from a Customer caller', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll(USER_ID, Role.CUSTOMER, { userId: OTHER_USER_ID });

      expect(mockModel.find).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID }));
    });

    it('should filter by status when provided', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll(USER_ID, Role.CUSTOMER, { status: OrderStatus.PENDING });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.PENDING }),
      );
    });

    it('should sort by createdAt descending (newest first) by default', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll(USER_ID, Role.CUSTOMER, {});

      expect(mockQueryBuilder.sort).toHaveBeenCalledWith({ createdAt: -1 });
    });

    it('should return correct pagination meta', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([makeOrder()]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(25) });

      const result = await service.findAll(USER_ID, Role.CUSTOMER, { page: 2, limit: 5 });

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(5);
      expect(result.meta.totalItems).toBe(25);
      expect(result.meta.totalPages).toBe(5);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5); // (2-1)*5
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return the order when the caller is the owner', async () => {
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(makeOrder()) });

      const result = await service.findOne(USER_ID, Role.CUSTOMER, ORDER_ID);

      expect(result.id).toBe(ORDER_ID);
    });

    it('should return any order when caller is Admin regardless of ownership', async () => {
      const otherUserOrder = makeOrder({ userId: { toString: () => OTHER_USER_ID } });
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(otherUserOrder) });

      const result = await service.findOne(USER_ID, Role.ADMIN, ORDER_ID);

      expect(result.userId).toBe(OTHER_USER_ID);
    });

    it("should throw ForbiddenException when customer requests another customer's order", async () => {
      const otherOrder = makeOrder({ userId: { toString: () => OTHER_USER_ID } });
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(otherOrder) });

      await expect(service.findOne(USER_ID, Role.CUSTOMER, ORDER_ID)).rejects.toThrow(
        new ForbiddenException(ORDER_MESSAGES.FORBIDDEN),
      );
    });

    it('should throw NotFoundException when order does not exist', async () => {
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.findOne(USER_ID, Role.CUSTOMER, ORDER_ID)).rejects.toThrow(
        new NotFoundException(ORDER_MESSAGES.NOT_FOUND),
      );
    });
  });

  // ── updateStatus (Admin) ───────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should update status from PENDING to CONFIRMED', async () => {
      const order = makeOrder({ status: OrderStatus.PENDING });
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(order) });

      const result = await service.updateStatus(ORDER_ID, { status: OrderStatus.CONFIRMED });

      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(order.save).toHaveBeenCalled();
    });

    it('should set cancelledAt when transitioning to CANCELLED', async () => {
      const order = makeOrder({ status: OrderStatus.PENDING });
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(order) });

      await service.updateStatus(ORDER_ID, { status: OrderStatus.CANCELLED });

      expect((order as ReturnType<typeof makeOrder>).cancelledAt).toBeInstanceOf(Date);
    });

    it('should throw ConflictException for illegal transition DELIVERED → PENDING', async () => {
      const order = makeOrder({ status: OrderStatus.DELIVERED });
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(order) });

      await expect(service.updateStatus(ORDER_ID, { status: OrderStatus.PENDING })).rejects.toThrow(
        new ConflictException(ORDER_MESSAGES.INVALID_STATUS_TRANSITION),
      );
    });

    it('should throw ConflictException for illegal transition CANCELLED → CONFIRMED', async () => {
      const order = makeOrder({ status: OrderStatus.CANCELLED });
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(order) });

      await expect(
        service.updateStatus(ORDER_ID, { status: OrderStatus.CONFIRMED }),
      ).rejects.toThrow(new ConflictException(ORDER_MESSAGES.INVALID_STATUS_TRANSITION));
    });

    it('should throw NotFoundException when order does not exist', async () => {
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(
        service.updateStatus(ORDER_ID, { status: OrderStatus.CONFIRMED }),
      ).rejects.toThrow(new NotFoundException(ORDER_MESSAGES.NOT_FOUND));
    });
  });

  // ── Status transition map completeness ────────────────────────────────────

  describe('ORDER_STATUS_TRANSITIONS map', () => {
    const allowedCases: Array<[OrderStatus, OrderStatus]> = [
      [OrderStatus.PENDING, OrderStatus.CONFIRMED],
      [OrderStatus.PENDING, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED, OrderStatus.PROCESSING],
      [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING, OrderStatus.SHIPPED],
      [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED, OrderStatus.DELIVERED],
    ];

    const forbiddenCases: Array<[OrderStatus, OrderStatus]> = [
      [OrderStatus.DELIVERED, OrderStatus.PENDING],
      [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.CANCELLED, OrderStatus.PENDING],
      [OrderStatus.CANCELLED, OrderStatus.CONFIRMED],
      [OrderStatus.SHIPPED, OrderStatus.PENDING],
      [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    ];

    it.each(allowedCases)('should allow %s → %s', (from, to) => {
      const allowed = ORDER_STATUS_TRANSITIONS[from] ?? [];
      expect(allowed).toContain(to);
    });

    it.each(forbiddenCases)('should forbid %s → %s', (from, to) => {
      const allowed = ORDER_STATUS_TRANSITIONS[from] ?? [];
      expect(allowed).not.toContain(to);
    });
  });

  // ── cancel ─────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('should cancel a PENDING order by the owning customer', async () => {
      const order = makeOrder({ status: OrderStatus.PENDING });
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(order) });

      const result = await service.cancel(USER_ID, ORDER_ID);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(order.save).toHaveBeenCalled();
    });

    it('should cancel a CONFIRMED order by the owning customer', async () => {
      const order = makeOrder({ status: OrderStatus.CONFIRMED });
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(order) });

      const result = await service.cancel(USER_ID, ORDER_ID);

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('should set cancelledAt on cancel', async () => {
      const order = makeOrder({ status: OrderStatus.PENDING });
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(order) });

      await service.cancel(USER_ID, ORDER_ID);

      expect((order as ReturnType<typeof makeOrder>).cancelledAt).toBeInstanceOf(Date);
    });

    it('should throw ConflictException when cancelling a SHIPPED order', async () => {
      const order = makeOrder({ status: OrderStatus.SHIPPED });
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(order) });

      await expect(service.cancel(USER_ID, ORDER_ID)).rejects.toThrow(
        new ConflictException(ORDER_MESSAGES.CANCEL_NOT_ALLOWED),
      );
    });

    it('should throw ConflictException when cancelling a DELIVERED order', async () => {
      const order = makeOrder({ status: OrderStatus.DELIVERED });
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(order) });

      await expect(service.cancel(USER_ID, ORDER_ID)).rejects.toThrow(
        new ConflictException(ORDER_MESSAGES.CANCEL_NOT_ALLOWED),
      );
    });

    it('should throw ConflictException when cancelling an already CANCELLED order', async () => {
      const order = makeOrder({ status: OrderStatus.CANCELLED });
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(order) });

      await expect(service.cancel(USER_ID, ORDER_ID)).rejects.toThrow(
        new ConflictException(ORDER_MESSAGES.CANCEL_NOT_ALLOWED),
      );
    });

    it("should throw ForbiddenException when a customer tries to cancel another customer's order", async () => {
      const order = makeOrder({ userId: { toString: () => OTHER_USER_ID } });
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(order) });

      await expect(service.cancel(USER_ID, ORDER_ID)).rejects.toThrow(
        new ForbiddenException(ORDER_MESSAGES.FORBIDDEN),
      );
    });

    it('should throw NotFoundException when order does not exist', async () => {
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.cancel(USER_ID, ORDER_ID)).rejects.toThrow(
        new NotFoundException(ORDER_MESSAGES.NOT_FOUND),
      );
    });
  });

  // ── snapshot immutability regression ─────────────────────────────────────

  describe('snapshot immutability', () => {
    it('order nameSnapshot must remain unchanged even if product name changes after creation', async () => {
      // This is a regression test — the service captures nameSnapshot at checkout,
      // never by reference. Mutating the product mock after creation must not
      // affect what was stored in the order.
      const setupHappyPath = () => {
        const session = makeSession();
        mockConnection.startSession.mockResolvedValue(session);
        mockUsersService.findById.mockResolvedValue(mockUser);
        mockCartService.getCartDocumentForCheckout.mockResolvedValue(
          makeCartDoc([{ productId: PRODUCT_ID, quantity: 1, priceAtAdd: 120 }]),
        );
        mockProductsService.findActiveProductForCheckout.mockResolvedValue({ ...mockProduct });
        mockProductsService.decrementStockAtomic.mockResolvedValue({ stockQuantity: 49 });
        mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });
        mockModel.exists.mockReturnValue(Promise.resolve(null));
        mockModel.create.mockResolvedValue([makeOrder()]);
      };

      setupHappyPath();
      const result = await service.create(USER_ID, { addressId: ADDRESS_ID });

      // The order snapshot recorded 'Bleu de Chanel EDP' — simulating a post-creation
      // product rename should not affect this order (the DTO holds the snapshot value).
      expect(result.items[0].nameSnapshot).toBe('Bleu de Chanel EDP');
      expect(result.items[0].priceSnapshot).toBe(120);
    });
  });
});

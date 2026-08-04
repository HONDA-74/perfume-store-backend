import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from '../../products/services/products.service';
import { CART_MESSAGES } from '../constants/cart.constants';
import { Cart } from '../schemas/cart.schema';
import { CartService } from './cart.service';

describe('CartService', () => {
  let service: CartService;

  const USER_ID = '66f1a2b3c4d5e6f7a8b9c000';
  const PRODUCT_ID = '66f1a2b3c4d5e6f7a8b9c001';
  const PRODUCT_ID_2 = '66f1a2b3c4d5e6f7a8b9c002';

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
    items: Array<{ productId: string; quantity: number; priceAtAdd: number }> = [],
  ) => ({
    id: '66f1a2b3c4d5e6f7a8b9c0ff',
    _id: '66f1a2b3c4d5e6f7a8b9c0ff',
    userId: { toString: () => USER_ID },
    items: items.map((i) => ({
      productId: { toString: () => i.productId },
      quantity: i.quantity,
      priceAtAdd: i.priceAtAdd,
    })),
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    save: jest.fn().mockResolvedValue(true),
  });

  const mockModel = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockProductsService = {
    findOneByIdOrSlug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: getModelToken(Cart.name), useValue: mockModel },
        { provide: ProductsService, useValue: mockProductsService },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    jest.clearAllMocks();
  });

  // ─── getCart ───────────────────────────────────────────────────────────────

  describe('getCart', () => {
    it('should return the existing cart for the user', async () => {
      const cart = makeCartDoc();
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cart) });

      const result = await service.getCart(USER_ID);

      expect(result.userId).toBe(USER_ID);
      expect(result.items).toHaveLength(0);
    });

    it('should create and return an empty cart when none exists', async () => {
      const newCart = makeCartDoc();
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      mockModel.create.mockResolvedValue(newCart);

      const result = await service.getCart(USER_ID);

      expect(result.items).toHaveLength(0);
      expect(mockModel.create).toHaveBeenCalledWith({ userId: USER_ID, items: [] });
    });

    it('should return cart with existing items', async () => {
      const cart = makeCartDoc([{ productId: PRODUCT_ID, quantity: 2, priceAtAdd: 120 }]);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cart) });

      const result = await service.getCart(USER_ID);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe(PRODUCT_ID);
      expect(result.items[0].quantity).toBe(2);
      expect(result.items[0].priceAtAdd).toBe(120);
    });
  });

  // ─── addItem ───────────────────────────────────────────────────────────────

  describe('addItem', () => {
    it('should add a new item to an empty cart', async () => {
      const cart = makeCartDoc();
      mockProductsService.findOneByIdOrSlug.mockResolvedValue(mockProduct);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cart) });

      const result = await service.addItem(USER_ID, { productId: PRODUCT_ID, quantity: 2 });

      expect(cart.items).toHaveLength(1);
      expect(cart.save).toHaveBeenCalled();
      expect(result.items[0].quantity).toBe(2);
    });

    it('should use discountPrice as priceAtAdd when present', async () => {
      const productWithDiscount = { ...mockProduct, price: 120, discountPrice: 99 };
      const cart = makeCartDoc();
      mockProductsService.findOneByIdOrSlug.mockResolvedValue(productWithDiscount);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cart) });

      await service.addItem(USER_ID, { productId: PRODUCT_ID, quantity: 1 });

      expect(cart.items[0].priceAtAdd).toBe(99);
    });

    it('should use base price as priceAtAdd when no discountPrice', async () => {
      const cart = makeCartDoc();
      mockProductsService.findOneByIdOrSlug.mockResolvedValue({
        ...mockProduct,
        discountPrice: undefined,
      });
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cart) });

      await service.addItem(USER_ID, { productId: PRODUCT_ID, quantity: 1 });

      expect(cart.items[0].priceAtAdd).toBe(120);
    });

    it('should increase quantity when item already exists in cart', async () => {
      const cart = makeCartDoc([{ productId: PRODUCT_ID, quantity: 3, priceAtAdd: 120 }]);
      mockProductsService.findOneByIdOrSlug.mockResolvedValue(mockProduct);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cart) });

      await service.addItem(USER_ID, { productId: PRODUCT_ID, quantity: 2 });

      expect(cart.items[0].quantity).toBe(5); // 3 + 2
      expect(cart.save).toHaveBeenCalled();
    });

    it('should throw ConflictException when requested quantity exceeds stock', async () => {
      const cart = makeCartDoc();
      mockProductsService.findOneByIdOrSlug.mockResolvedValue({ ...mockProduct, stockQuantity: 5 });
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cart) });

      await expect(
        service.addItem(USER_ID, { productId: PRODUCT_ID, quantity: 10 }),
      ).rejects.toThrow(new ConflictException(CART_MESSAGES.INSUFFICIENT_STOCK));
    });

    it('should throw ConflictException when existing quantity + new quantity exceeds stock', async () => {
      const cart = makeCartDoc([{ productId: PRODUCT_ID, quantity: 8, priceAtAdd: 120 }]);
      mockProductsService.findOneByIdOrSlug.mockResolvedValue({
        ...mockProduct,
        stockQuantity: 10,
      });
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cart) });

      await expect(
        service.addItem(USER_ID, { productId: PRODUCT_ID, quantity: 5 }),
      ).rejects.toThrow(new ConflictException(CART_MESSAGES.INSUFFICIENT_STOCK));
    });

    it('should throw NotFoundException when product does not exist', async () => {
      mockProductsService.findOneByIdOrSlug.mockRejectedValue(new NotFoundException());

      await expect(
        service.addItem(USER_ID, { productId: PRODUCT_ID, quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow adding when quantity exactly equals stock', async () => {
      const cart = makeCartDoc();
      mockProductsService.findOneByIdOrSlug.mockResolvedValue({ ...mockProduct, stockQuantity: 5 });
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cart) });

      await expect(
        service.addItem(USER_ID, { productId: PRODUCT_ID, quantity: 5 }),
      ).resolves.toBeDefined();
    });
  });

  // ─── updateItem ────────────────────────────────────────────────────────────

  describe('updateItem', () => {
    it('should update the quantity of an existing cart item', async () => {
      const cart = makeCartDoc([{ productId: PRODUCT_ID, quantity: 2, priceAtAdd: 120 }]);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cart) });
      mockProductsService.findOneByIdOrSlug.mockResolvedValue(mockProduct);

      const result = await service.updateItem(USER_ID, PRODUCT_ID, { quantity: 5 });

      expect(cart.items[0].quantity).toBe(5);
      expect(cart.save).toHaveBeenCalled();
      expect(result.items[0].quantity).toBe(5);
    });

    it('should throw NotFoundException when item is not in the cart', async () => {
      const cart = makeCartDoc(); // empty cart
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cart) });

      await expect(service.updateItem(USER_ID, PRODUCT_ID, { quantity: 3 })).rejects.toThrow(
        new NotFoundException(CART_MESSAGES.ITEM_NOT_FOUND),
      );
    });

    it('should throw ConflictException when updated quantity exceeds stock', async () => {
      const cart = makeCartDoc([{ productId: PRODUCT_ID, quantity: 2, priceAtAdd: 120 }]);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cart) });
      mockProductsService.findOneByIdOrSlug.mockResolvedValue({ ...mockProduct, stockQuantity: 3 });

      await expect(service.updateItem(USER_ID, PRODUCT_ID, { quantity: 10 })).rejects.toThrow(
        new ConflictException(CART_MESSAGES.INSUFFICIENT_STOCK),
      );
    });

    it('should allow updating to exactly stock quantity', async () => {
      const cart = makeCartDoc([{ productId: PRODUCT_ID, quantity: 1, priceAtAdd: 120 }]);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cart) });
      mockProductsService.findOneByIdOrSlug.mockResolvedValue({ ...mockProduct, stockQuantity: 5 });

      await expect(service.updateItem(USER_ID, PRODUCT_ID, { quantity: 5 })).resolves.toBeDefined();
    });
  });

  // ─── removeItem ────────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('should remove the specified item from the cart', async () => {
      const cart = makeCartDoc([
        { productId: PRODUCT_ID, quantity: 2, priceAtAdd: 120 },
        { productId: PRODUCT_ID_2, quantity: 1, priceAtAdd: 90 },
      ]);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cart) });

      const result = await service.removeItem(USER_ID, PRODUCT_ID);

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].productId.toString()).toBe(PRODUCT_ID_2);
      expect(cart.save).toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });

    it('should throw NotFoundException when item is not in the cart', async () => {
      const cart = makeCartDoc();
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cart) });

      await expect(service.removeItem(USER_ID, PRODUCT_ID)).rejects.toThrow(
        new NotFoundException(CART_MESSAGES.ITEM_NOT_FOUND),
      );
    });

    it('should result in an empty cart after removing the only item', async () => {
      const cart = makeCartDoc([{ productId: PRODUCT_ID, quantity: 1, priceAtAdd: 120 }]);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cart) });

      const result = await service.removeItem(USER_ID, PRODUCT_ID);

      expect(result.items).toHaveLength(0);
    });
  });

  // ─── clear ─────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('should empty all items from the cart', async () => {
      const cart = makeCartDoc([
        { productId: PRODUCT_ID, quantity: 2, priceAtAdd: 120 },
        { productId: PRODUCT_ID_2, quantity: 1, priceAtAdd: 90 },
      ]);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cart) });

      await service.clear(USER_ID);

      expect(cart.items).toHaveLength(0);
      expect(cart.save).toHaveBeenCalled();
    });

    it('should resolve to void on success', async () => {
      const cart = makeCartDoc();
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cart) });

      await expect(service.clear(USER_ID)).resolves.toBeUndefined();
    });

    it('should auto-create a cart if one does not exist, then clear it', async () => {
      const newCart = makeCartDoc();
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      mockModel.create.mockResolvedValue(newCart);

      await service.clear(USER_ID);

      expect(newCart.items).toHaveLength(0);
      expect(newCart.save).toHaveBeenCalled();
    });
  });
});

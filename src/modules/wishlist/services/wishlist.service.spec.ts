import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from '../../products/services/products.service';
import { WISHLIST_MESSAGES } from '../constants/wishlist.constants';
import { Wishlist } from '../schemas/wishlist.schema';
import { WishlistService } from './wishlist.service';

describe('WishlistService', () => {
  let service: WishlistService;

  const USER_ID = '66f1a2b3c4d5e6f7a8b9c000';
  const PRODUCT_ID = '66f1a2b3c4d5e6f7a8b9c001';
  const PRODUCT_ID_2 = '66f1a2b3c4d5e6f7a8b9c002';

  const NOW = new Date('2026-01-15T10:00:00.000Z');

  const mockProduct = {
    id: PRODUCT_ID,
    name: 'Bleu de Chanel EDP',
    price: 120,
    stockQuantity: 50,
    isActive: true,
    isDeleted: false,
  };

  /** Factory — creates a fresh mock wishlist document for each test. */
  const makeWishlistDoc = (items: Array<{ productId: string; addedAt: Date }> = []) => ({
    id: '66f1a2b3c4d5e6f7a8b9c0ff',
    _id: '66f1a2b3c4d5e6f7a8b9c0ff',
    userId: { toString: () => USER_ID },
    items: items.map((i) => ({
      productId: { toString: () => i.productId },
      addedAt: i.addedAt,
    })),
    createdAt: NOW,
    updatedAt: NOW,
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
        WishlistService,
        { provide: getModelToken(Wishlist.name), useValue: mockModel },
        { provide: ProductsService, useValue: mockProductsService },
      ],
    }).compile();

    service = module.get<WishlistService>(WishlistService);
    jest.clearAllMocks();
  });

  // ─── getWishlist ────────────────────────────────────────────────────────────

  describe('getWishlist', () => {
    it('should return the existing wishlist for the user', async () => {
      const wishlist = makeWishlistDoc();
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(wishlist) });

      const result = await service.getWishlist(USER_ID);

      expect(result.userId).toBe(USER_ID);
      expect(result.items).toHaveLength(0);
      expect(result.id).toBeDefined();
    });

    it('should auto-create and return an empty wishlist when none exists', async () => {
      const newWishlist = makeWishlistDoc();
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      mockModel.create.mockResolvedValue(newWishlist);

      const result = await service.getWishlist(USER_ID);

      expect(result.items).toHaveLength(0);
      expect(mockModel.create).toHaveBeenCalledWith({ userId: USER_ID, items: [] });
    });

    it('should return wishlist with existing items', async () => {
      const wishlist = makeWishlistDoc([{ productId: PRODUCT_ID, addedAt: NOW }]);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(wishlist) });

      const result = await service.getWishlist(USER_ID);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe(PRODUCT_ID);
      expect(result.items[0].addedAt).toEqual(NOW);
    });

    it('should return the same wishlist on repeated calls (idempotent get-or-create)', async () => {
      const wishlist = makeWishlistDoc();
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(wishlist) });

      await service.getWishlist(USER_ID);
      await service.getWishlist(USER_ID);

      expect(mockModel.create).not.toHaveBeenCalled();
    });

    it('should return all DTO fields (id, userId, items, createdAt, updatedAt)', async () => {
      const wishlist = makeWishlistDoc();
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(wishlist) });

      const result = await service.getWishlist(USER_ID);

      expect(result.id).toBeDefined();
      expect(result.userId).toBe(USER_ID);
      expect(result.items).toBeDefined();
      expect(result.createdAt).toEqual(NOW);
      expect(result.updatedAt).toEqual(NOW);
    });
  });

  // ─── addItem ────────────────────────────────────────────────────────────────

  describe('addItem', () => {
    it('should add a new product to an empty wishlist', async () => {
      const wishlist = makeWishlistDoc();
      mockProductsService.findOneByIdOrSlug.mockResolvedValue(mockProduct);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(wishlist) });

      const result = await service.addItem(USER_ID, PRODUCT_ID);

      expect(wishlist.items).toHaveLength(1);
      expect(wishlist.items[0].productId.toString()).toBe(PRODUCT_ID);
      expect(wishlist.save).toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });

    it('should set addedAt to the current time on add', async () => {
      const wishlist = makeWishlistDoc();
      mockProductsService.findOneByIdOrSlug.mockResolvedValue(mockProduct);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(wishlist) });

      const before = Date.now();
      await service.addItem(USER_ID, PRODUCT_ID);
      const after = Date.now();

      const addedAt = (wishlist.items[0] as unknown as { addedAt: Date }).addedAt;
      expect(addedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(addedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('should add multiple different products to the wishlist', async () => {
      const wishlist = makeWishlistDoc([{ productId: PRODUCT_ID, addedAt: NOW }]);
      mockProductsService.findOneByIdOrSlug.mockResolvedValue({ ...mockProduct, id: PRODUCT_ID_2 });
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(wishlist) });

      await service.addItem(USER_ID, PRODUCT_ID_2);

      expect(wishlist.items).toHaveLength(2);
    });

    it('should throw ConflictException (409) when product is already in wishlist', async () => {
      const wishlist = makeWishlistDoc([{ productId: PRODUCT_ID, addedAt: NOW }]);
      mockProductsService.findOneByIdOrSlug.mockResolvedValue(mockProduct);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(wishlist) });

      await expect(service.addItem(USER_ID, PRODUCT_ID)).rejects.toThrow(
        new ConflictException(WISHLIST_MESSAGES.ALREADY_IN_WISHLIST),
      );
    });

    it('should NOT save when the duplicate-check throws (no partial state)', async () => {
      const wishlist = makeWishlistDoc([{ productId: PRODUCT_ID, addedAt: NOW }]);
      mockProductsService.findOneByIdOrSlug.mockResolvedValue(mockProduct);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(wishlist) });

      await service.addItem(USER_ID, PRODUCT_ID).catch(() => null);

      expect(wishlist.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException (404) when product does not exist', async () => {
      mockProductsService.findOneByIdOrSlug.mockRejectedValue(new NotFoundException());

      await expect(service.addItem(USER_ID, PRODUCT_ID)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException (404) for an inactive product', async () => {
      // ProductsService.findOneByIdOrSlug enforces isActive && !isDeleted —
      // inactive/deleted products already surface as 404 with no extra logic needed.
      mockProductsService.findOneByIdOrSlug.mockRejectedValue(new NotFoundException());

      await expect(service.addItem(USER_ID, PRODUCT_ID)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException (404) for a soft-deleted product', async () => {
      mockProductsService.findOneByIdOrSlug.mockRejectedValue(new NotFoundException());

      await expect(service.addItem(USER_ID, PRODUCT_ID)).rejects.toThrow(NotFoundException);
    });

    it('should validate product existence BEFORE checking for duplicates', async () => {
      // If product lookup throws, the wishlist must never be read/modified.
      mockProductsService.findOneByIdOrSlug.mockRejectedValue(new NotFoundException());

      await service.addItem(USER_ID, PRODUCT_ID).catch(() => null);

      expect(mockModel.findOne).not.toHaveBeenCalled();
    });

    it('should auto-create wishlist on first add when none exists', async () => {
      const newWishlist = makeWishlistDoc();
      mockProductsService.findOneByIdOrSlug.mockResolvedValue(mockProduct);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      mockModel.create.mockResolvedValue(newWishlist);

      await service.addItem(USER_ID, PRODUCT_ID);

      expect(mockModel.create).toHaveBeenCalledWith({ userId: USER_ID, items: [] });
      expect(newWishlist.save).toHaveBeenCalled();
    });

    it('should return updated wishlist DTO after successful add', async () => {
      const wishlist = makeWishlistDoc();
      mockProductsService.findOneByIdOrSlug.mockResolvedValue(mockProduct);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(wishlist) });

      const result = await service.addItem(USER_ID, PRODUCT_ID);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });
  });

  // ─── removeItem ─────────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('should remove the specified product from the wishlist', async () => {
      const wishlist = makeWishlistDoc([
        { productId: PRODUCT_ID, addedAt: NOW },
        { productId: PRODUCT_ID_2, addedAt: NOW },
      ]);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(wishlist) });

      const result = await service.removeItem(USER_ID, PRODUCT_ID);

      expect(wishlist.items).toHaveLength(1);
      expect(wishlist.items[0].productId.toString()).toBe(PRODUCT_ID_2);
      expect(wishlist.save).toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });

    it('should result in an empty wishlist after removing the only item', async () => {
      const wishlist = makeWishlistDoc([{ productId: PRODUCT_ID, addedAt: NOW }]);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(wishlist) });

      const result = await service.removeItem(USER_ID, PRODUCT_ID);

      expect(result.items).toHaveLength(0);
    });

    it('should throw NotFoundException (404) when product is not in wishlist', async () => {
      const wishlist = makeWishlistDoc(); // empty
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(wishlist) });

      await expect(service.removeItem(USER_ID, PRODUCT_ID)).rejects.toThrow(
        new NotFoundException(WISHLIST_MESSAGES.ITEM_NOT_FOUND),
      );
    });

    it('should throw NotFoundException (404) when trying to remove a product that was never added', async () => {
      const wishlist = makeWishlistDoc([{ productId: PRODUCT_ID_2, addedAt: NOW }]);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(wishlist) });

      await expect(service.removeItem(USER_ID, PRODUCT_ID)).rejects.toThrow(
        new NotFoundException(WISHLIST_MESSAGES.ITEM_NOT_FOUND),
      );
    });

    it('should NOT save when item is not found (no partial state)', async () => {
      const wishlist = makeWishlistDoc();
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(wishlist) });

      await service.removeItem(USER_ID, PRODUCT_ID).catch(() => null);

      expect(wishlist.save).not.toHaveBeenCalled();
    });

    it('should not remove other items when removing one', async () => {
      const wishlist = makeWishlistDoc([
        { productId: PRODUCT_ID, addedAt: NOW },
        { productId: PRODUCT_ID_2, addedAt: NOW },
      ]);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(wishlist) });

      await service.removeItem(USER_ID, PRODUCT_ID_2);

      expect(wishlist.items).toHaveLength(1);
      expect(wishlist.items[0].productId.toString()).toBe(PRODUCT_ID);
    });

    it('should return updated wishlist DTO after successful remove', async () => {
      const wishlist = makeWishlistDoc([{ productId: PRODUCT_ID, addedAt: NOW }]);
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(wishlist) });

      const result = await service.removeItem(USER_ID, PRODUCT_ID);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('items');
      expect(result.items).toHaveLength(0);
    });

    it('should auto-create wishlist when none exists, then throw 404 (nothing to remove)', async () => {
      const newWishlist = makeWishlistDoc(); // empty after creation
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      mockModel.create.mockResolvedValue(newWishlist);

      await expect(service.removeItem(USER_ID, PRODUCT_ID)).rejects.toThrow(
        new NotFoundException(WISHLIST_MESSAGES.ITEM_NOT_FOUND),
      );
    });
  });
});

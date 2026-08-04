import { Test, TestingModule } from '@nestjs/testing';
import { WishlistResponseDto } from '../dto/wishlist-response.dto';
import { WishlistService } from '../services/wishlist.service';
import { WishlistController } from './wishlist.controller';

describe('WishlistController', () => {
  let controller: WishlistController;

  const USER_ID = '66f1a2b3c4d5e6f7a8b9c000';
  const PRODUCT_ID = '66f1a2b3c4d5e6f7a8b9c001';

  const mockResponse: WishlistResponseDto = {
    id: '66f1a2b3c4d5e6f7a8b9c0d1',
    userId: USER_ID,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWishlistService = {
    getWishlist: jest.fn(),
    addItem: jest.fn(),
    removeItem: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WishlistController],
      providers: [{ provide: WishlistService, useValue: mockWishlistService }],
    }).compile();

    controller = module.get<WishlistController>(WishlistController);
    jest.clearAllMocks();
  });

  describe('getWishlist', () => {
    it('should delegate to WishlistService.getWishlist with the caller userId', async () => {
      mockWishlistService.getWishlist.mockResolvedValue(mockResponse);

      const result = await controller.getWishlist(USER_ID);

      expect(mockWishlistService.getWishlist).toHaveBeenCalledWith(USER_ID);
      expect(result).toBe(mockResponse);
    });
  });

  describe('addItem', () => {
    it('should delegate to WishlistService.addItem with userId and productId', async () => {
      mockWishlistService.addItem.mockResolvedValue(mockResponse);

      const result = await controller.addItem(USER_ID, PRODUCT_ID);

      expect(mockWishlistService.addItem).toHaveBeenCalledWith(USER_ID, PRODUCT_ID);
      expect(result).toBe(mockResponse);
    });
  });

  describe('removeItem', () => {
    it('should delegate to WishlistService.removeItem with userId and productId', async () => {
      mockWishlistService.removeItem.mockResolvedValue(mockResponse);

      const result = await controller.removeItem(USER_ID, PRODUCT_ID);

      expect(mockWishlistService.removeItem).toHaveBeenCalledWith(USER_ID, PRODUCT_ID);
      expect(result).toBe(mockResponse);
    });
  });
});

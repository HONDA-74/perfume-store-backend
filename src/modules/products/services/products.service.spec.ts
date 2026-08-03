import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { PerfumeGender } from '../../../common/types/enums/perfume-gender.enum';
import { BrandsService } from '../../brands/services/brands.service';
import { CategoriesService } from '../../categories/services/categories.service';
import { PRODUCT_MESSAGES } from '../constants/products.constants';
import { StockOperation } from '../enums/stock-operation.enum';
import { Product } from '../schemas/product.schema';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;

  const mockProduct = {
    id: '66f1a2b3c4d5e6f7a8b9c0d1',
    _id: '66f1a2b3c4d5e6f7a8b9c0d1',
    name: 'Bleu de Chanel EDP',
    slug: 'bleu-de-chanel-edp',
    sku: 'CHN-BLEU-EDP-100',
    categoryId: { toString: () => '66f1a2b3c4d5e6f7a8b9c001' },
    brandId: { toString: () => '66f1a2b3c4d5e6f7a8b9c002' },
    description: 'A woody aromatic fragrance.',
    price: 120,
    discountPrice: undefined,
    stockQuantity: 50,
    gender: PerfumeGender.MALE,
    images: [],
    isActive: true,
    isDeleted: false,
    isFeatured: false,
    ratingAverage: 0,
    ratingCount: 0,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn(),
    set: jest.fn(),
  };

  const mockQueryBuilder = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };

  const mockModel = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
    exists: jest.fn(),
  };

  const mockCategoriesService = { findOneByIdOrSlug: jest.fn() };
  const mockBrandsService = { findOneByIdOrSlug: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getModelToken(Product.name), useValue: mockModel },
        { provide: CategoriesService, useValue: mockCategoriesService },
        { provide: BrandsService, useValue: mockBrandsService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto = {
      name: 'Bleu de Chanel EDP',
      sku: 'chn-bleu-edp-100',
      categoryId: '66f1a2b3c4d5e6f7a8b9c001',
      brandId: '66f1a2b3c4d5e6f7a8b9c002',
      description: 'A woody aromatic fragrance.',
      price: 120,
      stockQuantity: 50,
      gender: PerfumeGender.MALE,
    };

    it('should successfully create a product', async () => {
      mockCategoriesService.findOneByIdOrSlug.mockResolvedValue({});
      mockBrandsService.findOneByIdOrSlug.mockResolvedValue({});
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      mockModel.create.mockResolvedValue(mockProduct);

      const result = await service.create(dto);

      expect(result.name).toBe(dto.name);
      expect(result.sku).toBe(mockProduct.sku);
      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ sku: 'CHN-BLEU-EDP-100', slug: 'bleu-de-chanel-edp' }),
      );
    });

    it('should throw NotFoundException when category does not exist', async () => {
      mockCategoriesService.findOneByIdOrSlug.mockRejectedValue(new NotFoundException());
      mockBrandsService.findOneByIdOrSlug.mockResolvedValue({});

      await expect(service.create(dto)).rejects.toThrow(
        new NotFoundException(PRODUCT_MESSAGES.CATEGORY_NOT_FOUND),
      );
    });

    it('should throw BadRequestException when discountPrice is not less than price', async () => {
      mockCategoriesService.findOneByIdOrSlug.mockResolvedValue({});
      mockBrandsService.findOneByIdOrSlug.mockResolvedValue({});

      await expect(service.create({ ...dto, discountPrice: 150 })).rejects.toThrow(
        new BadRequestException(PRODUCT_MESSAGES.INVALID_DISCOUNT_PRICE),
      );
    });

    it('should throw ConflictException on duplicate SKU', async () => {
      mockCategoriesService.findOneByIdOrSlug.mockResolvedValue({});
      mockBrandsService.findOneByIdOrSlug.mockResolvedValue({});
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockProduct) });

      await expect(service.create(dto)).rejects.toThrow(
        new ConflictException(PRODUCT_MESSAGES.DUPLICATE_SKU),
      );
    });
  });

  describe('findAll', () => {
    it('should return a paginated list of products', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([mockProduct]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.meta.totalItems).toBe(1);
    });

    it('should apply price range and text search filters', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll({ minPrice: 50, maxPrice: 200, search: 'chanel', page: 1, limit: 10 });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          price: { $gte: 50, $lte: 200 },
          $text: { $search: 'chanel' },
        }),
      );
    });
  });

  describe('findOneByIdOrSlug', () => {
    it('should find product by slug', async () => {
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockProduct) });

      const result = await service.findOneByIdOrSlug('bleu-de-chanel-edp');

      expect(result.id).toBe(mockProduct.id);
    });

    it('should throw NotFoundException if product is not found', async () => {
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.findOneByIdOrSlug('missing')).rejects.toThrow(
        new NotFoundException(PRODUCT_MESSAGES.NOT_FOUND),
      );
    });
  });

  describe('remove', () => {
    it('should soft-delete a product', async () => {
      const existing = { ...mockProduct, save: jest.fn().mockResolvedValue(true) };
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) });

      await service.remove(mockProduct.id);

      expect(existing.isDeleted).toBe(true);
      expect(existing.isActive).toBe(false);
      expect(existing.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if product to delete is missing', async () => {
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.remove(mockProduct.id)).rejects.toThrow(
        new NotFoundException(PRODUCT_MESSAGES.NOT_FOUND),
      );
    });
  });

  describe('updateStock', () => {
    it('should increment stock', async () => {
      mockModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockProduct, stockQuantity: 60 }),
      });

      const result = await service.updateStock(mockProduct.id, {
        quantity: 10,
        operation: StockOperation.INCREMENT,
      });

      expect(result.stockQuantity).toBe(60);
    });

    it('should throw ConflictException when decrement would go negative', async () => {
      mockModel.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      mockModel.exists.mockResolvedValue(true);

      await expect(
        service.updateStock(mockProduct.id, {
          quantity: 1000,
          operation: StockOperation.DECREMENT,
        }),
      ).rejects.toThrow(new ConflictException(PRODUCT_MESSAGES.INSUFFICIENT_STOCK));
    });

    it('should throw NotFoundException when product does not exist', async () => {
      mockModel.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      mockModel.exists.mockResolvedValue(false);

      await expect(
        service.updateStock('missing-id', { quantity: 1, operation: StockOperation.SET }),
      ).rejects.toThrow(new NotFoundException(PRODUCT_MESSAGES.NOT_FOUND));
    });
  });
});

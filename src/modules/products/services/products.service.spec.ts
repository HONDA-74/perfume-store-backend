import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { PerfumeGender } from '../../../common/types/enums/perfume-gender.enum';
import { BrandsService } from '../../brands/services/brands.service';
import { CategoriesService } from '../../categories/services/categories.service';
import { PRODUCT_MESSAGES } from '../constants/products.constants';
import { ProductConcentration } from '../enums/product-concentration.enum';
import { StockOperation } from '../enums/stock-operation.enum';
import { Product } from '../schemas/product.schema';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;

  const CATEGORY_ID = '66f1a2b3c4d5e6f7a8b9c001';
  const BRAND_ID = '66f1a2b3c4d5e6f7a8b9c002';
  const PRODUCT_ID = '66f1a2b3c4d5e6f7a8b9c0d1';

  const mockProduct = {
    id: PRODUCT_ID,
    _id: PRODUCT_ID,
    name: 'Bleu de Chanel EDP',
    slug: 'bleu-de-chanel-edp',
    sku: 'CHN-BLEU-EDP-100',
    categoryId: { toString: () => CATEGORY_ID },
    brandId: { toString: () => BRAND_ID },
    description: 'A woody aromatic fragrance with citrus top notes.',
    price: 120,
    discountPrice: undefined,
    stockQuantity: 50,
    gender: PerfumeGender.MALE,
    concentration: ProductConcentration.EDP,
    sizeMl: 100,
    notes: { top: ['Bergamot'], middle: ['Jasmine'], base: ['Sandalwood'] },
    images: [],
    isActive: true,
    isFeatured: false,
    ratingAverage: 0,
    ratingCount: 0,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
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

  const mockCategoriesService = {
    findOneByIdOrSlug: jest.fn(),
  };

  const mockBrandsService = {
    findOneByIdOrSlug: jest.fn(),
  };

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

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = {
      name: 'Bleu de Chanel EDP',
      sku: 'CHN-BLEU-EDP-100',
      categoryId: CATEGORY_ID,
      brandId: BRAND_ID,
      description: 'A woody aromatic fragrance with citrus top notes.',
      price: 120,
      stockQuantity: 50,
      gender: PerfumeGender.MALE,
    };

    it('should create a product and return a response DTO', async () => {
      mockCategoriesService.findOneByIdOrSlug.mockResolvedValue({ id: CATEGORY_ID });
      mockBrandsService.findOneByIdOrSlug.mockResolvedValue({ id: BRAND_ID });
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      mockModel.create.mockResolvedValue(mockProduct);

      const result = await service.create(createDto);

      expect(result.name).toBe('Bleu de Chanel EDP');
      expect(result.slug).toBe('bleu-de-chanel-edp');
      expect(result.sku).toBe('CHN-BLEU-EDP-100');
    });

    it('should generate slug from name via slugify', async () => {
      mockCategoriesService.findOneByIdOrSlug.mockResolvedValue({ id: CATEGORY_ID });
      mockBrandsService.findOneByIdOrSlug.mockResolvedValue({ id: BRAND_ID });
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      mockModel.create.mockResolvedValue({
        ...mockProduct,
        name: 'Tom Ford Noir',
        slug: 'tom-ford-noir',
        sku: 'TF-NOIR-100',
      });

      const result = await service.create({
        ...createDto,
        name: 'Tom Ford Noir',
        sku: 'TF-NOIR-100',
      });

      expect(result.slug).toBe('tom-ford-noir');
    });

    it('should uppercase SKU on create', async () => {
      mockCategoriesService.findOneByIdOrSlug.mockResolvedValue({ id: CATEGORY_ID });
      mockBrandsService.findOneByIdOrSlug.mockResolvedValue({ id: BRAND_ID });
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      mockModel.create.mockResolvedValue({ ...mockProduct, sku: 'CHN-BLEU-EDP-100' });

      await service.create({ ...createDto, sku: 'chn-bleu-edp-100' });

      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ sku: 'CHN-BLEU-EDP-100' }),
      );
    });

    it('should throw NotFoundException when category does not exist', async () => {
      mockCategoriesService.findOneByIdOrSlug.mockRejectedValue(new NotFoundException());
      mockBrandsService.findOneByIdOrSlug.mockResolvedValue({ id: BRAND_ID });

      await expect(service.create(createDto)).rejects.toThrow(
        new NotFoundException(PRODUCT_MESSAGES.CATEGORY_NOT_FOUND),
      );
    });

    it('should throw NotFoundException when brand does not exist', async () => {
      mockCategoriesService.findOneByIdOrSlug.mockResolvedValue({ id: CATEGORY_ID });
      mockBrandsService.findOneByIdOrSlug.mockRejectedValue(new NotFoundException());

      await expect(service.create(createDto)).rejects.toThrow(
        new NotFoundException(PRODUCT_MESSAGES.BRAND_NOT_FOUND),
      );
    });

    it('should throw ConflictException on duplicate SKU', async () => {
      mockCategoriesService.findOneByIdOrSlug.mockResolvedValue({ id: CATEGORY_ID });
      mockBrandsService.findOneByIdOrSlug.mockResolvedValue({ id: BRAND_ID });
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockProduct, sku: 'CHN-BLEU-EDP-100' }),
      });

      await expect(service.create(createDto)).rejects.toThrow(
        new ConflictException(PRODUCT_MESSAGES.DUPLICATE_SKU),
      );
    });

    it('should throw ConflictException on duplicate slug', async () => {
      mockCategoriesService.findOneByIdOrSlug.mockResolvedValue({ id: CATEGORY_ID });
      mockBrandsService.findOneByIdOrSlug.mockResolvedValue({ id: BRAND_ID });
      // Different SKU but same slug (slug derived from name)
      mockModel.findOne.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ ...mockProduct, sku: 'OTHER-SKU', slug: 'bleu-de-chanel-edp' }),
      });

      await expect(service.create(createDto)).rejects.toThrow(
        new ConflictException(PRODUCT_MESSAGES.DUPLICATE_SLUG),
      );
    });

    it('should throw BadRequestException when discountPrice >= price', async () => {
      mockCategoriesService.findOneByIdOrSlug.mockResolvedValue({ id: CATEGORY_ID });
      mockBrandsService.findOneByIdOrSlug.mockResolvedValue({ id: BRAND_ID });

      await expect(
        service.create({ ...createDto, price: 100, discountPrice: 100 }),
      ).rejects.toThrow(new BadRequestException(PRODUCT_MESSAGES.INVALID_DISCOUNT_PRICE));
    });

    it('should throw BadRequestException when discountPrice > price', async () => {
      mockCategoriesService.findOneByIdOrSlug.mockResolvedValue({ id: CATEGORY_ID });
      mockBrandsService.findOneByIdOrSlug.mockResolvedValue({ id: BRAND_ID });

      await expect(
        service.create({ ...createDto, price: 100, discountPrice: 150 }),
      ).rejects.toThrow(new BadRequestException(PRODUCT_MESSAGES.INVALID_DISCOUNT_PRICE));
    });

    it('should accept discountPrice that is strictly less than price', async () => {
      mockCategoriesService.findOneByIdOrSlug.mockResolvedValue({ id: CATEGORY_ID });
      mockBrandsService.findOneByIdOrSlug.mockResolvedValue({ id: BRAND_ID });
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      mockModel.create.mockResolvedValue({ ...mockProduct, price: 120, discountPrice: 99 });

      const result = await service.create({ ...createDto, price: 120, discountPrice: 99 });

      expect(result.discountPrice).toBe(99);
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return a paginated list of active, non-deleted products', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([mockProduct]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.meta.totalItems).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should always filter by isDeleted: false and isActive: true', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll({});

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: false, isActive: true }),
      );
    });

    it('should apply categoryId filter when provided', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([mockProduct]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });

      await service.findAll({ categoryId: CATEGORY_ID });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: CATEGORY_ID }),
      );
    });

    it('should apply brandId filter when provided', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll({ brandId: BRAND_ID });

      expect(mockModel.find).toHaveBeenCalledWith(expect.objectContaining({ brandId: BRAND_ID }));
    });

    it('should apply gender filter when provided', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([mockProduct]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });

      await service.findAll({ gender: PerfumeGender.MALE });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ gender: PerfumeGender.MALE }),
      );
    });

    it('should apply minPrice filter when provided', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll({ minPrice: 100 });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ price: expect.objectContaining({ $gte: 100 }) }),
      );
    });

    it('should apply maxPrice filter when provided', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll({ maxPrice: 150 });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ price: expect.objectContaining({ $lte: 150 }) }),
      );
    });

    it('should apply both minPrice and maxPrice as a range filter', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll({ minPrice: 50, maxPrice: 200 });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ price: { $gte: 50, $lte: 200 } }),
      );
    });

    it('should apply isFeatured filter when provided', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll({ isFeatured: true });

      expect(mockModel.find).toHaveBeenCalledWith(expect.objectContaining({ isFeatured: true }));
    });

    it('should apply inStock filter (stockQuantity > 0) when provided', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll({ inStock: true });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ stockQuantity: { $gt: 0 } }),
      );
    });

    it('should use Mongo $text search — not regex — when search is provided', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([mockProduct]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });

      await service.findAll({ search: 'woody' });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ $text: { $search: 'woody' } }),
      );
      // Ensure no regex was used (AI_RULES §29 — no unindexed regex scans)
      const callArg = (mockModel.find as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      expect(callArg).not.toHaveProperty('name');
      expect(callArg).not.toHaveProperty('description');
    });

    it('should apply price:asc sort when specified', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll({ sort: 'price:asc' });

      expect(mockQueryBuilder.sort).toHaveBeenCalledWith({ price: 1 });
    });

    it('should apply price:desc sort when specified', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll({ sort: 'price:desc' });

      expect(mockQueryBuilder.sort).toHaveBeenCalledWith({ price: -1 });
    });

    it('should apply createdAt:desc sort when specified', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll({ sort: 'createdAt:desc' });

      expect(mockQueryBuilder.sort).toHaveBeenCalledWith({ createdAt: -1 });
    });

    it('should apply name:asc sort when specified', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll({ sort: 'name:asc' });

      expect(mockQueryBuilder.sort).toHaveBeenCalledWith({ name: 1 });
    });

    it('should default to isFeatured desc then createdAt desc when no sort provided', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll({});

      expect(mockQueryBuilder.sort).toHaveBeenCalledWith({ isFeatured: -1, createdAt: -1 });
    });

    it('should respect pagination skip and limit', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(30) });

      await service.findAll({ page: 3, limit: 5 });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10); // (3 - 1) * 5
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(5);
    });

    it('should use lean() for read-only queries', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      await service.findAll({});

      expect(mockQueryBuilder.lean).toHaveBeenCalled();
    });

    it('should return empty items array when no products match', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      const result = await service.findAll({ search: 'nonexistent' });

      expect(result.items).toHaveLength(0);
      expect(result.meta.totalItems).toBe(0);
    });
  });

  // ─── findOneByIdOrSlug ─────────────────────────────────────────────────────

  describe('findOneByIdOrSlug', () => {
    it('should find a product by ObjectId when param is a valid ObjectId', async () => {
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockProduct) });

      const result = await service.findOneByIdOrSlug(PRODUCT_ID);

      expect(result.id).toBe(PRODUCT_ID);
      expect(mockModel.findOne).toHaveBeenCalledWith({
        _id: PRODUCT_ID,
        isDeleted: false,
        isActive: true,
      });
    });

    it('should find a product by slug when param is not a valid ObjectId', async () => {
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockProduct) });

      const result = await service.findOneByIdOrSlug('bleu-de-chanel-edp');

      expect(result.slug).toBe('bleu-de-chanel-edp');
      expect(mockModel.findOne).toHaveBeenCalledWith({
        slug: 'bleu-de-chanel-edp',
        isDeleted: false,
        isActive: true,
      });
    });

    it('should throw NotFoundException when product is not found by ObjectId', async () => {
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.findOneByIdOrSlug(PRODUCT_ID)).rejects.toThrow(
        new NotFoundException(PRODUCT_MESSAGES.NOT_FOUND),
      );
    });

    it('should throw NotFoundException when product is not found by slug', async () => {
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.findOneByIdOrSlug('non-existent-slug')).rejects.toThrow(
        new NotFoundException(PRODUCT_MESSAGES.NOT_FOUND),
      );
    });

    it('should enforce isActive:true and isDeleted:false in the query', async () => {
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await service.findOneByIdOrSlug('some-slug').catch(() => null);

      expect(mockModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: false, isActive: true }),
      );
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should successfully update description without changing slug', async () => {
      const existing = { ...mockProduct, save: jest.fn().mockResolvedValue(true) };
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) });

      const result = await service.update(PRODUCT_ID, { description: 'New description' });

      expect(result.description).toBe('New description');
      expect(existing.save).toHaveBeenCalled();
    });

    it('should regenerate slug when name changes', async () => {
      const existing = {
        ...mockProduct,
        name: 'Old Name',
        slug: 'old-name',
        save: jest.fn().mockResolvedValue(true),
      };
      mockModel.findOne
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(existing) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) }); // uniqueness check

      const result = await service.update(PRODUCT_ID, { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(result.slug).toBe('new-name');
    });

    it('should not change slug when name is unchanged', async () => {
      const existing = { ...mockProduct, save: jest.fn().mockResolvedValue(true) };
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) });

      const result = await service.update(PRODUCT_ID, { name: 'Bleu de Chanel EDP' });

      expect(result.slug).toBe('bleu-de-chanel-edp');
    });

    it('should validate category reference when categoryId changes', async () => {
      const existing = { ...mockProduct, save: jest.fn().mockResolvedValue(true) };
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) });
      mockCategoriesService.findOneByIdOrSlug.mockRejectedValue(new NotFoundException());
      mockBrandsService.findOneByIdOrSlug.mockResolvedValue({ id: BRAND_ID });

      await expect(
        service.update(PRODUCT_ID, { categoryId: '66f1a2b3c4d5e6f7a8b9c999' }),
      ).rejects.toThrow(new NotFoundException(PRODUCT_MESSAGES.CATEGORY_NOT_FOUND));
    });

    it('should throw BadRequestException when updated discountPrice >= updated price', async () => {
      const existing = { ...mockProduct, price: 100, save: jest.fn() };
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) });

      await expect(service.update(PRODUCT_ID, { price: 80, discountPrice: 80 })).rejects.toThrow(
        new BadRequestException(PRODUCT_MESSAGES.INVALID_DISCOUNT_PRICE),
      );
    });

    it('should throw ConflictException on duplicate SKU in update', async () => {
      const existing = {
        ...mockProduct,
        sku: 'OLD-SKU',
        save: jest.fn(),
      };
      mockModel.findOne
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(existing) })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue({ ...mockProduct, sku: 'CHN-BLEU-EDP-100' }),
        });

      await expect(service.update(PRODUCT_ID, { sku: 'CHN-BLEU-EDP-100' })).rejects.toThrow(
        new ConflictException(PRODUCT_MESSAGES.DUPLICATE_SKU),
      );
    });

    it('should throw NotFoundException when product to update does not exist', async () => {
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(
        service.update('66f1a2b3c4d5e6f7a8b9c999', { description: 'X' }),
      ).rejects.toThrow(new NotFoundException(PRODUCT_MESSAGES.NOT_FOUND));
    });

    it('should update images array', async () => {
      const existing = { ...mockProduct, images: [], save: jest.fn().mockResolvedValue(true) };
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) });

      const newImages = ['https://example.com/img1.jpg'];
      const result = await service.update(PRODUCT_ID, { images: newImages });

      expect(result.images).toEqual(newImages);
    });

    it('should update isFeatured flag', async () => {
      const existing = {
        ...mockProduct,
        isFeatured: false,
        save: jest.fn().mockResolvedValue(true),
      };
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) });

      const result = await service.update(PRODUCT_ID, { isFeatured: true });

      expect(result.isFeatured).toBe(true);
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should soft-delete: set isDeleted, isActive=false, deletedAt', async () => {
      const existing = {
        ...mockProduct,
        isDeleted: false,
        isActive: true,
        deletedAt: null,
        save: jest.fn().mockResolvedValue(true),
      };
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) });

      await service.remove(PRODUCT_ID);

      expect(existing.isDeleted).toBe(true);
      expect(existing.isActive).toBe(false);
      expect(existing.deletedAt).toBeInstanceOf(Date);
      expect(existing.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when product does not exist', async () => {
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.remove('66f1a2b3c4d5e6f7a8b9c999')).rejects.toThrow(
        new NotFoundException(PRODUCT_MESSAGES.NOT_FOUND),
      );
    });

    it('should resolve to void on success', async () => {
      const existing = { ...mockProduct, save: jest.fn().mockResolvedValue(true) };
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) });

      await expect(service.remove(PRODUCT_ID)).resolves.toBeUndefined();
    });

    it('should query with isDeleted: false so already-deleted product returns 404', async () => {
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await service.remove(PRODUCT_ID).catch(() => null);

      expect(mockModel.findOne).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: false }));
    });
  });

  // ─── updateStock ───────────────────────────────────────────────────────────

  describe('updateStock', () => {
    it('should SET stock to the specified quantity', async () => {
      const updated = { ...mockProduct, stockQuantity: 25 };
      mockModel.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

      const result = await service.updateStock(PRODUCT_ID, {
        quantity: 25,
        operation: StockOperation.SET,
      });

      expect(result.stockQuantity).toBe(25);
      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: PRODUCT_ID }),
        { $set: { stockQuantity: 25 } },
        { new: true },
      );
    });

    it('should INCREMENT stock by the specified quantity', async () => {
      const updated = { ...mockProduct, stockQuantity: 55 };
      mockModel.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

      const result = await service.updateStock(PRODUCT_ID, {
        quantity: 5,
        operation: StockOperation.INCREMENT,
      });

      expect(result.stockQuantity).toBe(55);
      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: PRODUCT_ID }),
        { $inc: { stockQuantity: 5 } },
        { new: true },
      );
    });

    it('should DECREMENT stock atomically using a guard condition', async () => {
      const updated = { ...mockProduct, stockQuantity: 40 };
      mockModel.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

      const result = await service.updateStock(PRODUCT_ID, {
        quantity: 10,
        operation: StockOperation.DECREMENT,
      });

      expect(result.stockQuantity).toBe(40);
      // Guard condition: stockQuantity must be >= quantity before decrement
      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ stockQuantity: { $gte: 10 } }),
        { $inc: { stockQuantity: -10 } },
        { new: true },
      );
    });

    it('should throw ConflictException when DECREMENT would result in negative stock', async () => {
      // findOneAndUpdate returns null when guard condition fails
      mockModel.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      // The product does exist (just not enough stock)
      mockModel.exists.mockReturnValue(Promise.resolve({ _id: PRODUCT_ID }));

      await expect(
        service.updateStock(PRODUCT_ID, { quantity: 1000, operation: StockOperation.DECREMENT }),
      ).rejects.toThrow(new ConflictException(PRODUCT_MESSAGES.INSUFFICIENT_STOCK));
    });

    it('should throw NotFoundException when product does not exist', async () => {
      mockModel.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      mockModel.exists.mockReturnValue(Promise.resolve(null));

      await expect(
        service.updateStock('66f1a2b3c4d5e6f7a8b9c999', {
          quantity: 5,
          operation: StockOperation.INCREMENT,
        }),
      ).rejects.toThrow(new NotFoundException(PRODUCT_MESSAGES.NOT_FOUND));
    });

    it('should SET stock to 0 without error (valid for clearing stock)', async () => {
      const updated = { ...mockProduct, stockQuantity: 0 };
      mockModel.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

      const result = await service.updateStock(PRODUCT_ID, {
        quantity: 0,
        operation: StockOperation.SET,
      });

      expect(result.stockQuantity).toBe(0);
    });
  });
});

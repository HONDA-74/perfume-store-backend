import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { BRAND_MESSAGES } from '../constants/brands.constants';
import { Brand } from '../schemas/brand.schema';
import { BrandsService } from './brands.service';

describe('BrandsService', () => {
  let service: BrandsService;

  const mockBrand = {
    id: '66f1a2b3c4d5e6f7a8b9c0d2',
    _id: '66f1a2b3c4d5e6f7a8b9c0d2',
    name: 'Chanel',
    slug: 'chanel',
    description: 'French luxury fashion house founded in 1910.',
    logoUrl: 'https://res.cloudinary.com/perfume-store/brands/chanel-logo.jpg',
    countryOfOrigin: 'France',
    isActive: true,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn(),
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
    countDocuments: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandsService,
        {
          provide: getModelToken(Brand.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<BrandsService>(BrandsService);

    jest.clearAllMocks();
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should successfully create a brand', async () => {
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockModel.create.mockResolvedValue(mockBrand);

      const dto = {
        name: 'Chanel',
        description: 'French luxury fashion house founded in 1910.',
        logoUrl: 'https://res.cloudinary.com/perfume-store/brands/chanel-logo.jpg',
        countryOfOrigin: 'France',
      };

      const result = await service.create(dto);

      expect(result.name).toBe(dto.name);
      expect(result.slug).toBe('chanel');
      expect(mockModel.create).toHaveBeenCalledWith({
        name: dto.name,
        slug: 'chanel',
        description: dto.description,
        logoUrl: dto.logoUrl,
        countryOfOrigin: dto.countryOfOrigin,
      });
    });

    it('should generate a correct slug from multi-word name', async () => {
      const createdBrand = { ...mockBrand, name: 'Tom Ford', slug: 'tom-ford' };
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockModel.create.mockResolvedValue(createdBrand);

      const result = await service.create({ name: 'Tom Ford' });

      expect(result.slug).toBe('tom-ford');
      expect(mockModel.create).toHaveBeenCalledWith(expect.objectContaining({ slug: 'tom-ford' }));
    });

    it('should throw ConflictException on duplicate name', async () => {
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBrand),
      });

      await expect(service.create({ name: 'Chanel' })).rejects.toThrow(
        new ConflictException(BRAND_MESSAGES.DUPLICATE_NAME),
      );
    });

    it('should throw ConflictException on duplicate slug', async () => {
      // Same slug, different name — the duplicate check hits slug match
      const duplicateSlugBrand = { ...mockBrand, name: 'Different Name' };
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(duplicateSlugBrand),
      });

      await expect(service.create({ name: 'Chanel' })).rejects.toThrow(
        new ConflictException(BRAND_MESSAGES.DUPLICATE_SLUG),
      );
    });

    it('should create brand without optional fields', async () => {
      const minimalBrand = {
        ...mockBrand,
        description: undefined,
        logoUrl: undefined,
        countryOfOrigin: undefined,
      };
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockModel.create.mockResolvedValue(minimalBrand);

      const result = await service.create({ name: 'Chanel' });

      expect(result.name).toBe('Chanel');
      expect(result.description).toBeUndefined();
      expect(result.logoUrl).toBeUndefined();
      expect(result.countryOfOrigin).toBeUndefined();
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return a paginated list of brands', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([mockBrand]);
      mockModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(mockBrand.id);
      expect(result.meta.totalItems).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should always filter by isDeleted: false and isActive: true', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.findAll({});

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: false, isActive: true }),
      );
    });

    it('should apply search filter with case-insensitive regex', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([mockBrand]);
      mockModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      await service.findAll({ search: 'Chanel', page: 1, limit: 10 });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          name: { $regex: 'Chanel', $options: 'i' },
        }),
      );
    });

    it('should escape special regex characters in search string', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.findAll({ search: 'Tom+Ford', page: 1, limit: 10 });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          name: { $regex: 'Tom\\+Ford', $options: 'i' },
        }),
      );
    });

    it('should sort by name:asc when specified', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([mockBrand]);
      mockModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      await service.findAll({ sort: 'name:asc', page: 1, limit: 10 });

      expect(mockQueryBuilder.sort).toHaveBeenCalledWith({ name: 1 });
    });

    it('should default to createdAt:desc sort when no sort provided', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([mockBrand]);
      mockModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.findAll({ page: 1, limit: 10 });

      expect(mockQueryBuilder.sort).toHaveBeenCalledWith({ createdAt: -1 });
    });

    it('should respect pagination skip and limit', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(25),
      });

      await service.findAll({ page: 3, limit: 5 });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10); // (3-1) * 5
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(5);
    });

    it('should return empty items array when no brands match', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([]);
      mockModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      const result = await service.findAll({ search: 'NonExistent' });

      expect(result.items).toHaveLength(0);
      expect(result.meta.totalItems).toBe(0);
    });
  });

  // ─── findOneByIdOrSlug ─────────────────────────────────────────────────────

  describe('findOneByIdOrSlug', () => {
    it('should find brand by ObjectId when param is a valid ObjectId', async () => {
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBrand),
      });

      const result = await service.findOneByIdOrSlug(mockBrand.id);

      expect(result.id).toBe(mockBrand.id);
      expect(mockModel.findOne).toHaveBeenCalledWith({
        _id: mockBrand.id,
        isDeleted: false,
        isActive: true,
      });
    });

    it('should find brand by slug when param is not a valid ObjectId', async () => {
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBrand),
      });

      const result = await service.findOneByIdOrSlug('chanel');

      expect(result.id).toBe(mockBrand.id);
      expect(mockModel.findOne).toHaveBeenCalledWith({
        slug: 'chanel',
        isDeleted: false,
        isActive: true,
      });
    });

    it('should throw NotFoundException when brand is not found by id', async () => {
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOneByIdOrSlug('66f1a2b3c4d5e6f7a8b9c999')).rejects.toThrow(
        new NotFoundException(BRAND_MESSAGES.NOT_FOUND),
      );
    });

    it('should throw NotFoundException when brand is not found by slug', async () => {
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOneByIdOrSlug('non-existent-slug')).rejects.toThrow(
        new NotFoundException(BRAND_MESSAGES.NOT_FOUND),
      );
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should successfully update description', async () => {
      const existingBrand = { ...mockBrand, save: jest.fn().mockResolvedValue(true) };
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingBrand),
      });

      const result = await service.update(mockBrand.id, {
        description: 'Updated description',
      });

      expect(result.description).toBe('Updated description');
      expect(existingBrand.save).toHaveBeenCalled();
    });

    it('should successfully update logoUrl', async () => {
      const existingBrand = { ...mockBrand, save: jest.fn().mockResolvedValue(true) };
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingBrand),
      });

      const newLogoUrl = 'https://res.cloudinary.com/new-logo.jpg';
      const result = await service.update(mockBrand.id, { logoUrl: newLogoUrl });

      expect(result.logoUrl).toBe(newLogoUrl);
      expect(existingBrand.save).toHaveBeenCalled();
    });

    it('should successfully update countryOfOrigin', async () => {
      const existingBrand = {
        ...mockBrand,
        countryOfOrigin: 'France',
        save: jest.fn().mockResolvedValue(true),
      };
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingBrand),
      });

      const result = await service.update(mockBrand.id, { countryOfOrigin: 'Italy' });

      expect(result.countryOfOrigin).toBe('Italy');
      expect(existingBrand.save).toHaveBeenCalled();
    });

    it('should regenerate slug when name changes and new name is available', async () => {
      const existingBrand = {
        ...mockBrand,
        name: 'Old Brand',
        slug: 'old-brand',
        save: jest.fn().mockResolvedValue(true),
      };

      mockModel.findOne
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(existingBrand) }) // fetch brand
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) }); // assertNameAndSlugAvailable

      const result = await service.update(mockBrand.id, { name: 'New Brand' });

      expect(result.name).toBe('New Brand');
      expect(result.slug).toBe('new-brand');
      expect(existingBrand.save).toHaveBeenCalled();
    });

    it('should not change slug when name is unchanged', async () => {
      const existingBrand = {
        ...mockBrand,
        name: 'Chanel',
        slug: 'chanel',
        save: jest.fn().mockResolvedValue(true),
      };
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingBrand),
      });

      const result = await service.update(mockBrand.id, { name: 'Chanel' });

      expect(result.slug).toBe('chanel');
    });

    it('should throw NotFoundException when brand to update does not exist', async () => {
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.update('66f1a2b3c4d5e6f7a8b9c999', { description: 'New' }),
      ).rejects.toThrow(new NotFoundException(BRAND_MESSAGES.NOT_FOUND));
    });

    it('should throw ConflictException when new name conflicts with another brand', async () => {
      const existingBrand = {
        ...mockBrand,
        name: 'Old Brand',
        slug: 'old-brand',
        save: jest.fn(),
      };
      const conflictingBrand = { ...mockBrand, name: 'Dior', slug: 'dior' };

      mockModel.findOne
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(existingBrand) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(conflictingBrand) });

      await expect(service.update(mockBrand.id, { name: 'Dior' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should soft-delete brand: set isDeleted, isActive=false, deletedAt', async () => {
      const existingBrand = {
        ...mockBrand,
        isDeleted: false,
        isActive: true,
        deletedAt: null,
        save: jest.fn().mockResolvedValue(true),
      };
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingBrand),
      });

      await service.remove(mockBrand.id);

      expect(existingBrand.isDeleted).toBe(true);
      expect(existingBrand.isActive).toBe(false);
      expect(existingBrand.deletedAt).toBeInstanceOf(Date);
      expect(existingBrand.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when brand to delete does not exist', async () => {
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.remove('66f1a2b3c4d5e6f7a8b9c999')).rejects.toThrow(
        new NotFoundException(BRAND_MESSAGES.NOT_FOUND),
      );
    });

    it('should not throw when brand was active and is now being deleted', async () => {
      const existingBrand = { ...mockBrand, save: jest.fn().mockResolvedValue(true) };
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingBrand),
      });

      await expect(service.remove(mockBrand.id)).resolves.toBeUndefined();
    });
  });
});

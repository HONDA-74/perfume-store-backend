import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { CATEGORY_MESSAGES } from '../constants/categories.constants';
import { Category } from '../schemas/category.schema';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const mockCategory = {
    id: '66f1a2b3c4d5e6f7a8b9c0d1',
    _id: '66f1a2b3c4d5e6f7a8b9c0d1',
    name: 'Eau de Parfum',
    slug: 'eau-de-parfum',
    description: 'Long-lasting fragrances',
    imageUrl: 'https://res.cloudinary.com/image.jpg',
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
        CategoriesService,
        {
          provide: getModelToken(Category.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully create a category', async () => {
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockModel.create.mockResolvedValue(mockCategory);

      const dto = {
        name: 'Eau de Parfum',
        description: 'Long-lasting fragrances',
        imageUrl: 'https://res.cloudinary.com/image.jpg',
      };

      const result = await service.create(dto);

      expect(result.name).toBe(dto.name);
      expect(result.slug).toBe('eau-de-parfum');
      expect(mockModel.create).toHaveBeenCalledWith({
        name: dto.name,
        slug: 'eau-de-parfum',
        description: dto.description,
        imageUrl: dto.imageUrl,
      });
    });

    it('should throw ConflictException on duplicate name', async () => {
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCategory),
      });

      const dto = {
        name: 'Eau de Parfum',
      };

      await expect(service.create(dto)).rejects.toThrow(
        new ConflictException(CATEGORY_MESSAGES.DUPLICATE_NAME),
      );
    });

    it('should throw ConflictException on duplicate slug', async () => {
      const duplicateSlugCategory = { ...mockCategory, name: 'Different Name' };
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(duplicateSlugCategory),
      });

      const dto = {
        name: 'Eau de Parfum',
      };

      await expect(service.create(dto)).rejects.toThrow(
        new ConflictException(CATEGORY_MESSAGES.DUPLICATE_SLUG),
      );
    });
  });

  describe('findAll', () => {
    it('should return a paginated list of categories', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([mockCategory]);
      mockModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(mockCategory.id);
      expect(result.meta.totalItems).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should apply search filter safely', async () => {
      mockModel.find.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.exec.mockResolvedValue([mockCategory]);
      mockModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      await service.findAll({ search: 'Eau', page: 1, limit: 10 });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          name: { $regex: 'Eau', $options: 'i' },
        }),
      );
    });
  });

  describe('findOneByIdOrSlug', () => {
    it('should find category by ID if it is a valid ObjectId', async () => {
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCategory),
      });

      const result = await service.findOneByIdOrSlug(mockCategory.id);

      expect(result.id).toBe(mockCategory.id);
      expect(mockModel.findOne).toHaveBeenCalledWith({
        _id: mockCategory.id,
        isDeleted: false,
        isActive: true,
      });
    });

    it('should find category by slug if it is not a valid ObjectId', async () => {
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCategory),
      });

      const result = await service.findOneByIdOrSlug('eau-de-parfum');

      expect(result.id).toBe(mockCategory.id);
      expect(mockModel.findOne).toHaveBeenCalledWith({
        slug: 'eau-de-parfum',
        isDeleted: false,
        isActive: true,
      });
    });

    it('should throw NotFoundException if category is not found', async () => {
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOneByIdOrSlug('non-existent')).rejects.toThrow(
        new NotFoundException(CATEGORY_MESSAGES.NOT_FOUND),
      );
    });
  });

  describe('update', () => {
    it('should successfully update category properties', async () => {
      const existingCategory = {
        ...mockCategory,
        save: jest.fn().mockResolvedValue(true),
      };
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingCategory),
      });

      const dto = {
        description: 'New Description',
      };

      const result = await service.update(mockCategory.id, dto);

      expect(result.description).toBe('New Description');
      expect(existingCategory.save).toHaveBeenCalled();
    });

    it('should update slug if name changes and is available', async () => {
      const existingCategory = {
        ...mockCategory,
        name: 'Old Name',
        slug: 'old-name',
        save: jest.fn().mockResolvedValue(true),
      };

      // Mock first findOne for category retrieval
      // Mock second findOne (inside assertNameAndSlugAvailable) to return null
      mockModel.findOne
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(existingCategory),
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(null),
        });

      const dto = {
        name: 'New Name',
      };

      const result = await service.update(mockCategory.id, dto);

      expect(result.name).toBe('New Name');
      expect(result.slug).toBe('new-name');
    });

    it('should throw NotFoundException if category to update is not found', async () => {
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.update('66f1a2b3c4d5e6f7a8b9c0d1', {})).rejects.toThrow(
        new NotFoundException(CATEGORY_MESSAGES.NOT_FOUND),
      );
    });
  });

  describe('remove', () => {
    it('should soft-delete category successfully', async () => {
      const existingCategory = {
        ...mockCategory,
        save: jest.fn().mockResolvedValue(true),
      };
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingCategory),
      });

      await service.remove(mockCategory.id);

      expect(existingCategory.isDeleted).toBe(true);
      expect(existingCategory.isActive).toBe(false);
      expect(existingCategory.deletedAt).toBeInstanceOf(Date);
      expect(existingCategory.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if category to delete is not found', async () => {
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.remove('66f1a2b3c4d5e6f7a8b9c0d1')).rejects.toThrow(
        new NotFoundException(CATEGORY_MESSAGES.NOT_FOUND),
      );
    });
  });
});

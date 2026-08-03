import { HttpStatus, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { Role } from '../../src/common/types/enums/role.enum';
import { CATEGORY_MESSAGES } from '../../src/modules/categories/constants/categories.constants';
import { Category, CategoryDocument } from '../../src/modules/categories/schemas/category.schema';

describe('Categories Module (E2E)', () => {
  let app: INestApplication;
  let categoryModel: Model<CategoryDocument>;
  let jwtService: JwtService;
  let adminToken: string;
  let customerToken: string;

  const adminPayload = {
    sub: '66f1a2b3c4d5e6f7a8b9c000',
    email: 'admin@luxuryperfume.com',
    role: Role.ADMIN,
  };

  const customerPayload = {
    sub: '66f1a2b3c4d5e6f7a8b9c001',
    email: 'customer@luxuryperfume.com',
    role: Role.CUSTOMER,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    // Use filters, pipes and interceptors matching main.ts
    // In NestJS E2E, we must wire global configurations manually if they are registered in main.ts
    const { MongoExceptionFilter } =
      await import('../../src/common/filters/mongo-exception.filter');
    const { HttpExceptionFilter } = await import('../../src/common/filters/http-exception.filter');
    const { TransformResponseInterceptor } =
      await import('../../src/common/interceptors/transform-response.interceptor');
    const { GlobalValidationPipe } = await import('../../src/common/pipes/validation.pipe');

    app.useGlobalPipes(new GlobalValidationPipe());
    app.useGlobalFilters(new MongoExceptionFilter(), new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformResponseInterceptor());

    await app.init();

    categoryModel = moduleFixture.get<Model<CategoryDocument>>(getModelToken(Category.name));
    jwtService = moduleFixture.get<JwtService>(JwtService);

    adminToken = jwtService.sign(adminPayload);
    customerToken = jwtService.sign(customerPayload);
  });

  beforeEach(async () => {
    await categoryModel.deleteMany({});
  });

  afterAll(async () => {
    await categoryModel.deleteMany({});
    await app.close();
  });

  describe('POST /api/v1/categories', () => {
    const createDto = {
      name: 'Eau de Parfum',
      description: 'High concentration of oils',
      imageUrl: 'https://res.cloudinary.com/perfume/edp.jpg',
    };

    it('should successfully create category when requested by Admin', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(createDto.name);
      expect(response.body.data.slug).toBe('eau-de-parfum');
      expect(response.body.data.id).toBeDefined();
    });

    it('should throw 401 Unauthorized when token is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/categories')
        .send(createDto)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should throw 403 Forbidden when requested by Customer', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(createDto)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should throw 409 Conflict when name already exists', async () => {
      await categoryModel.create({
        name: 'Eau de Parfum',
        slug: 'eau-de-parfum',
        isActive: true,
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createDto)
        .expect(HttpStatus.CONFLICT);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(CATEGORY_MESSAGES.DUPLICATE_NAME);
    });
  });

  describe('GET /api/v1/categories', () => {
    beforeEach(async () => {
      await categoryModel.create([
        { name: 'Oud Perfumes', slug: 'oud-perfumes', isActive: true },
        { name: 'Floral Scents', slug: 'floral-scents', isActive: true },
        { name: 'Inactive Category', slug: 'inactive-category', isActive: false },
      ]);
    });

    it('should return paginated active categories list publicly', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2); // Only active ones
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.totalItems).toBe(2);
    });

    it('should support search query', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .query({ search: 'Oud' })
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].slug).toBe('oud-perfumes');
    });

    it('should support sorting', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .query({ sort: 'name:asc' })
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data[0].slug).toBe('floral-scents');
      expect(response.body.data[1].slug).toBe('oud-perfumes');
    });
  });

  describe('GET /api/v1/categories/:idOrSlug', () => {
    let createdCategory: CategoryDocument;

    beforeEach(async () => {
      createdCategory = await categoryModel.create({
        name: 'Eau de Toilette',
        slug: 'eau-de-toilette',
        isActive: true,
      });
    });

    it('should find category by ObjectId publicly', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/categories/${createdCategory.id}`)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Eau de Toilette');
    });

    it('should find category by slug publicly', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/categories/eau-de-toilette')
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(createdCategory.id);
    });

    it('should throw 404 Not Found if category is missing', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/categories/missing-slug')
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('PATCH /api/v1/categories/:id', () => {
    let createdCategory: CategoryDocument;

    beforeEach(async () => {
      createdCategory = await categoryModel.create({
        name: 'Cologne',
        slug: 'cologne',
        isActive: true,
      });
    });

    it('should update category when requested by Admin', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/categories/${createdCategory.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Fresh Cologne', description: 'Very fresh' })
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Fresh Cologne');
      expect(response.body.data.slug).toBe('fresh-cologne');
    });

    it('should throw 400 Bad Request on invalid ObjectId', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/categories/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Fresh Cologne' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should throw 404 Not Found for non-existent category', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/categories/66f1a2b3c4d5e6f7a8b9c999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Fresh Cologne' })
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('DELETE /api/v1/categories/:id', () => {
    let createdCategory: CategoryDocument;

    beforeEach(async () => {
      createdCategory = await categoryModel.create({
        name: 'Elixir',
        slug: 'elixir',
        isActive: true,
      });
    });

    it('should soft-delete category when requested by Admin', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/categories/${createdCategory.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NO_CONTENT);

      const dbCategory = await categoryModel.findById(createdCategory.id);
      expect(dbCategory?.isDeleted).toBe(true);
      expect(dbCategory?.isActive).toBe(false);
      expect(dbCategory?.deletedAt).toBeInstanceOf(Date);
    });

    it('should throw 400 Bad Request on invalid ObjectId', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/categories/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should throw 404 Not Found for non-existent category', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/categories/66f1a2b3c4d5e6f7a8b9c999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});

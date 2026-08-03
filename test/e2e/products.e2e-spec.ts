import { HttpStatus, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PerfumeGender } from '../../src/common/types/enums/perfume-gender.enum';
import { Role } from '../../src/common/types/enums/role.enum';
import { Brand, BrandDocument } from '../../src/modules/brands/schemas/brand.schema';
import { Category, CategoryDocument } from '../../src/modules/categories/schemas/category.schema';
import { PRODUCT_MESSAGES } from '../../src/modules/products/constants/products.constants';
import { Product, ProductDocument } from '../../src/modules/products/schemas/product.schema';

describe('Products Module (E2E)', () => {
  let app: INestApplication;
  let productModel: Model<ProductDocument>;
  let categoryModel: Model<CategoryDocument>;
  let brandModel: Model<BrandDocument>;
  let jwtService: JwtService;
  let adminToken: string;
  let customerToken: string;
  let categoryId: string;
  let brandId: string;

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

    productModel = moduleFixture.get<Model<ProductDocument>>(getModelToken(Product.name));
    categoryModel = moduleFixture.get<Model<CategoryDocument>>(getModelToken(Category.name));
    brandModel = moduleFixture.get<Model<BrandDocument>>(getModelToken(Brand.name));
    jwtService = moduleFixture.get<JwtService>(JwtService);

    adminToken = jwtService.sign(adminPayload);
    customerToken = jwtService.sign(customerPayload);
  });

  beforeEach(async () => {
    await productModel.deleteMany({});
    await categoryModel.deleteMany({});
    await brandModel.deleteMany({});

    const category = await categoryModel.create({
      name: 'Eau de Parfum',
      slug: 'eau-de-parfum',
      isActive: true,
    });
    const brand = await brandModel.create({ name: 'Chanel', slug: 'chanel', isActive: true });

    categoryId = category.id;
    brandId = brand.id;
  });

  afterAll(async () => {
    await productModel.deleteMany({});
    await categoryModel.deleteMany({});
    await brandModel.deleteMany({});
    await app.close();
  });

  const createDto = () => ({
    name: 'Bleu de Chanel EDP',
    sku: 'CHN-BLEU-EDP-100',
    categoryId,
    brandId,
    description: 'A woody aromatic fragrance with citrus top notes.',
    price: 120,
    stockQuantity: 50,
    gender: PerfumeGender.MALE,
  });

  describe('POST /api/v1/products', () => {
    it('should create a product when requested by Admin', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createDto())
        .expect(HttpStatus.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.slug).toBe('bleu-de-chanel-edp');
      expect(response.body.data.sku).toBe('CHN-BLEU-EDP-100');
    });

    it('should throw 403 Forbidden when requested by Customer', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(createDto())
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should throw 404 Not Found when category does not exist', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...createDto(), categoryId: '66f1a2b3c4d5e6f7a8b9c999' })
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toBe(PRODUCT_MESSAGES.CATEGORY_NOT_FOUND);
    });

    it('should throw 409 Conflict on duplicate SKU', async () => {
      await productModel.create({
        name: 'Existing Product',
        slug: 'existing-product',
        sku: 'CHN-BLEU-EDP-100',
        categoryId,
        brandId,
        description: 'desc',
        price: 100,
        stockQuantity: 10,
        gender: PerfumeGender.MALE,
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createDto())
        .expect(HttpStatus.CONFLICT);

      expect(response.body.message).toBe(PRODUCT_MESSAGES.DUPLICATE_SKU);
    });
  });

  describe('GET /api/v1/products', () => {
    beforeEach(async () => {
      await productModel.create([
        {
          name: 'Bleu de Chanel EDP',
          slug: 'bleu-de-chanel-edp',
          sku: 'CHN-BLEU-EDP-100',
          categoryId,
          brandId,
          description: 'Woody aromatic.',
          price: 120,
          stockQuantity: 50,
          gender: PerfumeGender.MALE,
          isActive: true,
          isFeatured: true,
        },
        {
          name: 'Chance EDP',
          slug: 'chance-edp',
          sku: 'CHN-CHANCE-EDP-50',
          categoryId,
          brandId,
          description: 'Floral fruity.',
          price: 90,
          stockQuantity: 0,
          gender: PerfumeGender.FEMALE,
          isActive: true,
        },
        {
          name: 'Inactive Product',
          slug: 'inactive-product',
          sku: 'INACTIVE-001',
          categoryId,
          brandId,
          description: 'Hidden.',
          price: 50,
          stockQuantity: 10,
          gender: PerfumeGender.UNISEX,
          isActive: false,
        },
      ]);
    });

    it('should return paginated active products publicly', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.totalItems).toBe(2);
    });

    it('should filter by price range', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ minPrice: 100, maxPrice: 150 })
        .expect(HttpStatus.OK);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].slug).toBe('bleu-de-chanel-edp');
    });

    it('should filter by inStock', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ inStock: true })
        .expect(HttpStatus.OK);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].slug).toBe('bleu-de-chanel-edp');
    });

    it('should filter by gender', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ gender: PerfumeGender.FEMALE })
        .expect(HttpStatus.OK);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].slug).toBe('chance-edp');
    });
  });

  describe('GET /api/v1/products/:idOrSlug', () => {
    it('should find a product by slug publicly', async () => {
      await productModel.create({
        name: 'Bleu de Chanel EDP',
        slug: 'bleu-de-chanel-edp',
        sku: 'CHN-BLEU-EDP-100',
        categoryId,
        brandId,
        description: 'Woody aromatic.',
        price: 120,
        stockQuantity: 50,
        gender: PerfumeGender.MALE,
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/products/bleu-de-chanel-edp')
        .expect(HttpStatus.OK);

      expect(response.body.data.name).toBe('Bleu de Chanel EDP');
    });

    it('should throw 404 for a non-existent product', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/products/missing-slug')
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('PATCH /api/v1/products/:id/stock', () => {
    let productId: string;

    beforeEach(async () => {
      const product = await productModel.create({
        name: 'Bleu de Chanel EDP',
        slug: 'bleu-de-chanel-edp',
        sku: 'CHN-BLEU-EDP-100',
        categoryId,
        brandId,
        description: 'Woody aromatic.',
        price: 120,
        stockQuantity: 10,
        gender: PerfumeGender.MALE,
      });
      productId = product.id;
    });

    it('should increment stock', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}/stock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 5, operation: 'INCREMENT' })
        .expect(HttpStatus.OK);

      expect(response.body.data.stockQuantity).toBe(15);
    });

    it('should throw 409 when decrement would go negative', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}/stock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 1000, operation: 'DECREMENT' })
        .expect(HttpStatus.CONFLICT);
    });
  });

  describe('DELETE /api/v1/products/:id', () => {
    it('should soft-delete a product when requested by Admin', async () => {
      const product = await productModel.create({
        name: 'Bleu de Chanel EDP',
        slug: 'bleu-de-chanel-edp',
        sku: 'CHN-BLEU-EDP-100',
        categoryId,
        brandId,
        description: 'Woody aromatic.',
        price: 120,
        stockQuantity: 10,
        gender: PerfumeGender.MALE,
      });

      await request(app.getHttpServer())
        .delete(`/api/v1/products/${product.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NO_CONTENT);

      const dbProduct = await productModel.findById(product.id);
      expect(dbProduct?.isDeleted).toBe(true);
      expect(dbProduct?.isActive).toBe(false);
    });
  });
});

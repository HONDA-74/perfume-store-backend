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
import { ProductConcentration } from '../../src/modules/products/enums/product-concentration.enum';
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

    categoryId = category.id as string;
    brandId = brand.id as string;
  });

  afterAll(async () => {
    await productModel.deleteMany({});
    await categoryModel.deleteMany({});
    await brandModel.deleteMany({});
    await app.close();
  });

  /** Minimal valid create payload — extend per test. */
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

  // ─── POST /api/v1/products ────────────────────────────────────────────────

  describe('POST /api/v1/products', () => {
    it('should create a product and return 201 when called by Admin', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createDto())
        .expect(HttpStatus.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.slug).toBe('bleu-de-chanel-edp');
      expect(response.body.data.sku).toBe('CHN-BLEU-EDP-100');
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.isActive).toBe(true);
    });

    it('should auto-uppercase SKU on create', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...createDto(), sku: 'chn-bleu-edp-100' })
        .expect(HttpStatus.CREATED);

      expect(response.body.data.sku).toBe('CHN-BLEU-EDP-100');
    });

    it('should create a product with all optional fields', async () => {
      const dto = {
        ...createDto(),
        discountPrice: 99,
        concentration: ProductConcentration.EDP,
        sizeMl: 100,
        notes: { top: ['Bergamot'], middle: ['Jasmine'], base: ['Sandalwood'] },
        isFeatured: true,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(HttpStatus.CREATED);

      expect(response.body.data.concentration).toBe(ProductConcentration.EDP);
      expect(response.body.data.sizeMl).toBe(100);
      expect(response.body.data.isFeatured).toBe(true);
      expect(response.body.data.notes.top).toEqual(['Bergamot']);
    });

    it('should return 401 Unauthorized when no token is provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .send(createDto())
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 Forbidden when called by a Customer', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(createDto())
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Only Name' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 when price is zero', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...createDto(), price: 0 })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 when stockQuantity is negative', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...createDto(), stockQuantity: -1 })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 when gender enum is invalid', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...createDto(), gender: 'INVALID_GENDER' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 when discountPrice >= price', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...createDto(), price: 100, discountPrice: 100 })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 when referenced category does not exist', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...createDto(), categoryId: '66f1a2b3c4d5e6f7a8b9c999' })
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toBe(PRODUCT_MESSAGES.CATEGORY_NOT_FOUND);
    });

    it('should return 404 when referenced brand does not exist', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...createDto(), brandId: '66f1a2b3c4d5e6f7a8b9c999' })
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toBe(PRODUCT_MESSAGES.BRAND_NOT_FOUND);
    });

    it('should return 409 Conflict on duplicate SKU', async () => {
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

    it('should return 409 Conflict on duplicate slug (same name)', async () => {
      await productModel.create({
        name: 'Bleu de Chanel EDP',
        slug: 'bleu-de-chanel-edp',
        sku: 'DIFFERENT-SKU-001',
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

      expect(response.body.message).toBe(PRODUCT_MESSAGES.DUPLICATE_SLUG);
    });
  });

  // ─── GET /api/v1/products ─────────────────────────────────────────────────

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

    it('should return only active products publicly without authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.totalItems).toBe(2);
    });

    it('should return all four pagination meta fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ page: 1, limit: 10 })
        .expect(HttpStatus.OK);

      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(10);
      expect(response.body.meta.totalItems).toBeDefined();
      expect(response.body.meta.totalPages).toBeDefined();
    });

    it('should filter by categoryId', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ categoryId })
        .expect(HttpStatus.OK);

      expect(response.body.data).toHaveLength(2);
    });

    it('should filter by gender', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ gender: PerfumeGender.FEMALE })
        .expect(HttpStatus.OK);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].slug).toBe('chance-edp');
    });

    it('should filter by price range (minPrice / maxPrice)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ minPrice: 100, maxPrice: 150 })
        .expect(HttpStatus.OK);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].slug).toBe('bleu-de-chanel-edp');
    });

    it('should filter by inStock=true (string from query param)', async () => {
      // Query params arrive as strings — @Type(() => Boolean) must handle this
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ inStock: 'true' })
        .expect(HttpStatus.OK);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].slug).toBe('bleu-de-chanel-edp');
    });

    it('should filter by isFeatured=true (string from query param)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ isFeatured: 'true' })
        .expect(HttpStatus.OK);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].isFeatured).toBe(true);
    });

    it('should sort by price:asc', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ sort: 'price:asc' })
        .expect(HttpStatus.OK);

      const prices = response.body.data.map((p: { price: number }) => p.price);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    });

    it('should sort by price:desc', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ sort: 'price:desc' })
        .expect(HttpStatus.OK);

      const prices = response.body.data.map((p: { price: number }) => p.price);
      expect(prices).toEqual([...prices].sort((a, b) => b - a));
    });

    it('should sort by name:asc', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ sort: 'name:asc' })
        .expect(HttpStatus.OK);

      const names = response.body.data.map((p: { name: string }) => p.name);
      expect(names).toEqual([...names].sort());
    });

    it('should paginate results correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ page: 1, limit: 1 })
        .expect(HttpStatus.OK);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.totalItems).toBe(2);
      expect(response.body.meta.totalPages).toBe(2);
    });

    it('should return 200 with empty data when no products exist', async () => {
      await productModel.deleteMany({});

      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .expect(HttpStatus.OK);

      expect(response.body.data).toHaveLength(0);
    });
  });

  // ─── GET /api/v1/products/:idOrSlug ───────────────────────────────────────

  describe('GET /api/v1/products/:idOrSlug', () => {
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
        stockQuantity: 50,
        gender: PerfumeGender.MALE,
        isActive: true,
      });
      productId = product.id as string;
    });

    it('should find a product by slug publicly', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/bleu-de-chanel-edp')
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Bleu de Chanel EDP');
    });

    it('should find a product by ObjectId publicly', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/products/${productId}`)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(productId);
      expect(response.body.data.slug).toBe('bleu-de-chanel-edp');
    });

    it('should return all expected fields in the response', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/bleu-de-chanel-edp')
        .expect(HttpStatus.OK);

      const data = response.body.data as Record<string, unknown>;
      expect(data.id).toBeDefined();
      expect(data.name).toBeDefined();
      expect(data.slug).toBeDefined();
      expect(data.sku).toBeDefined();
      expect(data.price).toBeDefined();
      expect(data.stockQuantity).toBeDefined();
      expect(data.gender).toBeDefined();
      expect(data.isActive).toBeDefined();
      expect(data.isFeatured).toBeDefined();
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();
      // Sensitive schema fields must never appear
      expect(data).not.toHaveProperty('isDeleted');
      expect(data).not.toHaveProperty('deletedAt');
      expect(data).not.toHaveProperty('__v');
    });

    it('should return 404 for a non-existent slug', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/products/missing-slug')
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 404 for a valid ObjectId that does not exist', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/products/66f1a2b3c4d5e6f7a8b9c999')
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 404 for an inactive product', async () => {
      const inactive = await productModel.create({
        name: 'Inactive One',
        slug: 'inactive-one',
        sku: 'INACTIVE-SLUG-001',
        categoryId,
        brandId,
        description: 'desc',
        price: 50,
        stockQuantity: 5,
        gender: PerfumeGender.UNISEX,
        isActive: false,
      });

      await request(app.getHttpServer())
        .get(`/api/v1/products/${inactive.id}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 404 for a soft-deleted product', async () => {
      await productModel.findByIdAndUpdate(productId, {
        isDeleted: true,
        isActive: false,
        deletedAt: new Date(),
      });

      await request(app.getHttpServer())
        .get(`/api/v1/products/${productId}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  // ─── PATCH /api/v1/products/:id ───────────────────────────────────────────

  describe('PATCH /api/v1/products/:id', () => {
    let productId: string;

    beforeEach(async () => {
      const product = await productModel.create({
        name: 'Bleu de Chanel EDP',
        slug: 'bleu-de-chanel-edp',
        sku: 'CHN-BLEU-EDP-100',
        categoryId,
        brandId,
        description: 'Original description.',
        price: 120,
        stockQuantity: 50,
        gender: PerfumeGender.MALE,
        isActive: true,
      });
      productId = product.id as string;
    });

    it('should update description when called by Admin', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Updated description.' })
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.description).toBe('Updated description.');
      expect(response.body.data.name).toBe('Bleu de Chanel EDP'); // unchanged
    });

    it('should regenerate slug when name changes', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Chance Eau Tendre' })
        .expect(HttpStatus.OK);

      expect(response.body.data.name).toBe('Chance Eau Tendre');
      expect(response.body.data.slug).toBe('chance-eau-tendre');
    });

    it('should update price and isFeatured', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 150, isFeatured: true })
        .expect(HttpStatus.OK);

      expect(response.body.data.price).toBe(150);
      expect(response.body.data.isFeatured).toBe(true);
    });

    it('should return 401 Unauthorized when no token is provided', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}`)
        .send({ description: 'No auth.' })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 Forbidden when called by a Customer', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ description: 'Customer update.' })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 400 for malformed ObjectId in :id param', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/products/not-an-object-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Bad id.' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 404 for a valid ObjectId that does not exist', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/products/66f1a2b3c4d5e6f7a8b9c999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Ghost.' })
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 409 when updated name produces a duplicate slug', async () => {
      await productModel.create({
        name: 'Chance EDP',
        slug: 'chance-edp',
        sku: 'CHN-CHANCE-001',
        categoryId,
        brandId,
        description: 'Floral.',
        price: 90,
        stockQuantity: 10,
        gender: PerfumeGender.FEMALE,
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Chance EDP' })
        .expect(HttpStatus.CONFLICT);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 when updated discountPrice >= updated price', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 80, discountPrice: 80 })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  // ─── DELETE /api/v1/products/:id ──────────────────────────────────────────

  describe('DELETE /api/v1/products/:id', () => {
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
        isActive: true,
      });
      productId = product.id as string;
    });

    it('should soft-delete a product and return 204 No Content', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NO_CONTENT);

      const dbProduct = await productModel.findById(productId);
      expect(dbProduct?.isDeleted).toBe(true);
      expect(dbProduct?.isActive).toBe(false);
      expect(dbProduct?.deletedAt).toBeInstanceOf(Date);
    });

    it('should hide soft-deleted product from public listing', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NO_CONTENT);

      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .expect(HttpStatus.OK);

      expect(response.body.data).toHaveLength(0);
    });

    it('should hide soft-deleted product from public detail lookup', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NO_CONTENT);

      await request(app.getHttpServer())
        .get(`/api/v1/products/${productId}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 401 Unauthorized when no token is provided', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/products/${productId}`)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 Forbidden when called by a Customer', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 400 for malformed ObjectId', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/products/not-an-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 404 for a valid ObjectId that does not exist', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/products/66f1a2b3c4d5e6f7a8b9c999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 404 when trying to delete an already soft-deleted product', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NO_CONTENT);

      await request(app.getHttpServer())
        .delete(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  // ─── PATCH /api/v1/products/:id/stock ─────────────────────────────────────

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
        isActive: true,
      });
      productId = product.id as string;
    });

    it('should INCREMENT stock', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}/stock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 5, operation: 'INCREMENT' })
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stockQuantity).toBe(15);
    });

    it('should DECREMENT stock', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}/stock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 3, operation: 'DECREMENT' })
        .expect(HttpStatus.OK);

      expect(response.body.data.stockQuantity).toBe(7);
    });

    it('should SET stock to an absolute value', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}/stock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 100, operation: 'SET' })
        .expect(HttpStatus.OK);

      expect(response.body.data.stockQuantity).toBe(100);
    });

    it('should SET stock to 0 (clearing stock is valid)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}/stock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 0, operation: 'SET' })
        .expect(HttpStatus.OK);

      expect(response.body.data.stockQuantity).toBe(0);
    });

    it('should throw 409 when DECREMENT would result in negative stock', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}/stock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 1000, operation: 'DECREMENT' })
        .expect(HttpStatus.CONFLICT);

      expect(response.body.message).toBe(PRODUCT_MESSAGES.INSUFFICIENT_STOCK);
    });

    it('should return 401 Unauthorized when no token is provided', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}/stock`)
        .send({ quantity: 5, operation: 'INCREMENT' })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 Forbidden when called by a Customer', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}/stock`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 5, operation: 'INCREMENT' })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 400 for an invalid operation enum value', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}/stock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 5, operation: 'MULTIPLY' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 for a non-integer quantity', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}/stock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 1.5, operation: 'INCREMENT' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 for malformed ObjectId in :id param', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/products/not-an-id/stock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 5, operation: 'INCREMENT' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 404 for a valid ObjectId that does not exist', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/products/66f1a2b3c4d5e6f7a8b9c999/stock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 5, operation: 'INCREMENT' })
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});

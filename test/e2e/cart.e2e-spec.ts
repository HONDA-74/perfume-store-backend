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
import { CART_MESSAGES } from '../../src/modules/cart/constants/cart.constants';
import { Cart, CartDocument } from '../../src/modules/cart/schemas/cart.schema';
import { Category, CategoryDocument } from '../../src/modules/categories/schemas/category.schema';
import { Product, ProductDocument } from '../../src/modules/products/schemas/product.schema';

describe('Cart Module (E2E)', () => {
  let app: INestApplication;
  let cartModel: Model<CartDocument>;
  let productModel: Model<ProductDocument>;
  let categoryModel: Model<CategoryDocument>;
  let brandModel: Model<BrandDocument>;
  let jwtService: JwtService;
  let customerToken: string;
  let adminToken: string;
  let productId: string;
  let productId2: string;
  let categoryId: string;
  let brandId: string;

  const customerPayload = {
    sub: '66f1a2b3c4d5e6f7a8b9c001',
    email: 'customer@test.com',
    role: Role.CUSTOMER,
  };

  const adminPayload = {
    sub: '66f1a2b3c4d5e6f7a8b9c000',
    email: 'admin@test.com',
    role: Role.ADMIN,
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

    cartModel = moduleFixture.get<Model<CartDocument>>(getModelToken(Cart.name));
    productModel = moduleFixture.get<Model<ProductDocument>>(getModelToken(Product.name));
    categoryModel = moduleFixture.get<Model<CategoryDocument>>(getModelToken(Category.name));
    brandModel = moduleFixture.get<Model<BrandDocument>>(getModelToken(Brand.name));
    jwtService = moduleFixture.get<JwtService>(JwtService);

    customerToken = jwtService.sign(customerPayload);
    adminToken = jwtService.sign(adminPayload);
  });

  beforeEach(async () => {
    await cartModel.deleteMany({});
    await productModel.deleteMany({});
    await categoryModel.deleteMany({});
    await brandModel.deleteMany({});

    const category = await categoryModel.create({
      name: 'EDP Cat',
      slug: 'edp-cat',
      isActive: true,
    });
    const brand = await brandModel.create({ name: 'TestBrand', slug: 'testbrand', isActive: true });
    categoryId = category.id as string;
    brandId = brand.id as string;

    const product1 = await productModel.create({
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

    const product2 = await productModel.create({
      name: 'Chance EDP',
      slug: 'chance-edp',
      sku: 'CHN-CHANCE-EDP-50',
      categoryId,
      brandId,
      description: 'Floral fruity.',
      price: 90,
      stockQuantity: 10,
      gender: PerfumeGender.FEMALE,
      isActive: true,
    });

    productId = product1.id as string;
    productId2 = product2.id as string;
  });

  afterAll(async () => {
    await cartModel.deleteMany({});
    await productModel.deleteMany({});
    await categoryModel.deleteMany({});
    await brandModel.deleteMany({});
    await app.close();
  });

  // ─── GET /api/v1/cart ──────────────────────────────────────────────────────

  describe('GET /api/v1/cart', () => {
    it('should return an empty cart (auto-created) on first access', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(0);
      expect(response.body.data.userId).toBe(customerPayload.sub);
      expect(response.body.data.id).toBeDefined();
    });

    it('should return the same cart on subsequent calls (idempotent creation)', async () => {
      const first = await request(app.getHttpServer())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      const second = await request(app.getHttpServer())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(first.body.data.id).toBe(second.body.data.id);
    });

    it('should return 401 Unauthorized when no token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/cart')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 Forbidden when called by Admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body.success).toBe(false);
    });
  });

  // ─── POST /api/v1/cart/items ───────────────────────────────────────────────

  describe('POST /api/v1/cart/items', () => {
    it('should add a product to the cart', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 2 })
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].productId).toBe(productId);
      expect(response.body.data.items[0].quantity).toBe(2);
      expect(response.body.data.items[0].priceAtAdd).toBe(120);
    });

    it('should snapshot discountPrice as priceAtAdd when product has a discount', async () => {
      await productModel.findByIdAndUpdate(productId, { discountPrice: 99 });

      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 1 })
        .expect(HttpStatus.OK);

      expect(response.body.data.items[0].priceAtAdd).toBe(99);
    });

    it('should accumulate quantity when adding the same product twice', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 2 });

      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 3 })
        .expect(HttpStatus.OK);

      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].quantity).toBe(5);
    });

    it('should add multiple different products', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 1 });

      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId: productId2, quantity: 1 })
        .expect(HttpStatus.OK);

      expect(response.body.data.items).toHaveLength(2);
    });

    it('should return 409 Conflict when quantity exceeds stock', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 100 })
        .expect(HttpStatus.CONFLICT);

      expect(response.body.message).toBe(CART_MESSAGES.INSUFFICIENT_STOCK);
    });

    it('should return 404 Not Found when product does not exist', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId: '66f1a2b3c4d5e6f7a8b9c999', quantity: 1 })
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 400 when productId is not a valid ObjectId', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId: 'not-an-id', quantity: 1 })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when quantity is zero', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 0 })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when quantity is a decimal', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 1.5 })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 401 when no token is provided', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .send({ productId, quantity: 1 })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 when called by Admin', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ productId, quantity: 1 })
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ─── PATCH /api/v1/cart/items/:productId ──────────────────────────────────

  describe('PATCH /api/v1/cart/items/:productId', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 2 });
    });

    it('should update the quantity of an existing cart item', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/cart/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 5 })
        .expect(HttpStatus.OK);

      expect(response.body.data.items[0].quantity).toBe(5);
    });

    it('should return 404 when product is not in the cart', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/cart/items/${productId2}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 1 })
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toBe(CART_MESSAGES.ITEM_NOT_FOUND);
    });

    it('should return 409 when updated quantity exceeds stock', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/cart/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 1000 })
        .expect(HttpStatus.CONFLICT);

      expect(response.body.message).toBe(CART_MESSAGES.INSUFFICIENT_STOCK);
    });

    it('should return 400 for malformed productId in param', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/cart/items/not-an-id')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 1 })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when quantity is zero', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/cart/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 0 })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 401 when no token is provided', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/cart/items/${productId}`)
        .send({ quantity: 1 })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 when called by Admin', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/cart/items/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 1 })
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ─── DELETE /api/v1/cart/items/:productId ─────────────────────────────────

  describe('DELETE /api/v1/cart/items/:productId', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 2 });
    });

    it('should remove an item from the cart', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/cart/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(0);
    });

    it('should return 404 when product is not in the cart', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/cart/items/${productId2}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toBe(CART_MESSAGES.ITEM_NOT_FOUND);
    });

    it('should return 400 for malformed productId in param', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/cart/items/not-an-id')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 401 when no token is provided', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/cart/items/${productId}`)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 when called by Admin', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/cart/items/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ─── DELETE /api/v1/cart ───────────────────────────────────────────────────

  describe('DELETE /api/v1/cart', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 2 });
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId: productId2, quantity: 1 });
    });

    it('should clear all items and return 204 No Content', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.NO_CONTENT);

      const response = await request(app.getHttpServer())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.data.items).toHaveLength(0);
    });

    it('should return 401 when no token is provided', async () => {
      await request(app.getHttpServer()).delete('/api/v1/cart').expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 when called by Admin', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/cart')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });
});

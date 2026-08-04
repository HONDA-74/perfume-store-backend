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
import { Product, ProductDocument } from '../../src/modules/products/schemas/product.schema';
import { WISHLIST_MESSAGES } from '../../src/modules/wishlist/constants/wishlist.constants';
import { Wishlist, WishlistDocument } from '../../src/modules/wishlist/schemas/wishlist.schema';

describe('Wishlist Module (E2E)', () => {
  let app: INestApplication;
  let wishlistModel: Model<WishlistDocument>;
  let productModel: Model<ProductDocument>;
  let categoryModel: Model<CategoryDocument>;
  let brandModel: Model<BrandDocument>;
  let jwtService: JwtService;

  let customerToken: string;
  let customerToken2: string;
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

  const customerPayload2 = {
    sub: '66f1a2b3c4d5e6f7a8b9c002',
    email: 'customer2@test.com',
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

    wishlistModel = moduleFixture.get<Model<WishlistDocument>>(getModelToken(Wishlist.name));
    productModel = moduleFixture.get<Model<ProductDocument>>(getModelToken(Product.name));
    categoryModel = moduleFixture.get<Model<CategoryDocument>>(getModelToken(Category.name));
    brandModel = moduleFixture.get<Model<BrandDocument>>(getModelToken(Brand.name));
    jwtService = moduleFixture.get<JwtService>(JwtService);

    customerToken = jwtService.sign(customerPayload);
    customerToken2 = jwtService.sign(customerPayload2);
    adminToken = jwtService.sign(adminPayload);
  });

  beforeEach(async () => {
    await wishlistModel.deleteMany({});
    await productModel.deleteMany({});
    await categoryModel.deleteMany({});
    await brandModel.deleteMany({});

    const category = await categoryModel.create({
      name: 'EDP Category',
      slug: 'edp-category',
      isActive: true,
    });
    const brand = await brandModel.create({
      name: 'Test Brand',
      slug: 'test-brand',
      isActive: true,
    });
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
    await wishlistModel.deleteMany({});
    await productModel.deleteMany({});
    await categoryModel.deleteMany({});
    await brandModel.deleteMany({});
    await app.close();
  });

  // ─── GET /api/v1/wishlist ──────────────────────────────────────────────────

  describe('GET /api/v1/wishlist', () => {
    it('should return an empty wishlist (auto-created) on first access', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(0);
      expect(response.body.data.userId).toBe(customerPayload.sub);
      expect(response.body.data.id).toBeDefined();
    });

    it('should return all expected DTO fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      const data = response.body.data as Record<string, unknown>;
      expect(data.id).toBeDefined();
      expect(data.userId).toBeDefined();
      expect(data.items).toBeDefined();
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();
      // Internal fields must never appear in the response
      expect(data).not.toHaveProperty('isDeleted');
      expect(data).not.toHaveProperty('deletedAt');
      expect(data).not.toHaveProperty('__v');
    });

    it('should return the same wishlist id on repeated calls (idempotent)', async () => {
      const first = await request(app.getHttpServer())
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      const second = await request(app.getHttpServer())
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(first.body.data.id).toBe(second.body.data.id);
    });

    it('should scope the wishlist to the requesting customer (two customers are isolated)', async () => {
      // Add an item for customer 1
      await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      // Customer 2 must see an empty wishlist
      const response = await request(app.getHttpServer())
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken2}`)
        .expect(HttpStatus.OK);

      expect(response.body.data.items).toHaveLength(0);
    });

    it('should return 401 Unauthorized when no token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/wishlist')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 Forbidden when called by Admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body.success).toBe(false);
    });
  });

  // ─── POST /api/v1/wishlist/items/:productId ────────────────────────────────

  describe('POST /api/v1/wishlist/items/:productId', () => {
    it('should add a product and return 200 OK', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].productId).toBe(productId);
    });

    it('should store addedAt timestamp for the new item', async () => {
      const before = Date.now();

      const response = await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      const addedAt = new Date(response.body.data.items[0].addedAt as string).getTime();
      const after = Date.now();
      expect(addedAt).toBeGreaterThanOrEqual(before);
      expect(addedAt).toBeLessThanOrEqual(after);
    });

    it('should add multiple different products', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId2}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.data.items).toHaveLength(2);
    });

    it('should return 409 Conflict when product is already in wishlist', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.CONFLICT);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(WISHLIST_MESSAGES.ALREADY_IN_WISHLIST);
    });

    it('should NOT double-add on duplicate — wishlist item count stays at 1', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      const response = await request(app.getHttpServer())
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.data.items).toHaveLength(1);
    });

    it('should return 404 Not Found when product does not exist', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/wishlist/items/66f1a2b3c4d5e6f7a8b9c999')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 Not Found for an inactive product', async () => {
      await productModel.findByIdAndUpdate(productId, { isActive: false });

      await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 404 Not Found for a soft-deleted product', async () => {
      await productModel.findByIdAndUpdate(productId, {
        isDeleted: true,
        isActive: false,
        deletedAt: new Date(),
      });

      await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 400 Bad Request for a malformed (non-ObjectId) productId', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/wishlist/items/not-an-id')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 401 Unauthorized when no token is provided', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId}`)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 Forbidden when called by Admin', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should scope additions correctly — customer 2 adding the same product does not conflict', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      // Same product, different customer — must succeed
      await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken2}`)
        .expect(HttpStatus.OK);
    });

    it('should auto-create wishlist and add in one call (first-time user)', async () => {
      // Ensure no wishlist document exists yet
      const count = await wishlistModel.countDocuments({ userId: customerPayload.sub });
      expect(count).toBe(0);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.data.items).toHaveLength(1);

      const created = await wishlistModel.countDocuments({ userId: customerPayload.sub });
      expect(created).toBe(1);
    });
  });

  // ─── DELETE /api/v1/wishlist/items/:productId ──────────────────────────────

  describe('DELETE /api/v1/wishlist/items/:productId', () => {
    beforeEach(async () => {
      // Pre-populate customer 1's wishlist with both products
      await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId2}`)
        .set('Authorization', `Bearer ${customerToken}`);
    });

    it('should remove the specified product and return 200 OK with updated wishlist', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].productId).toBe(productId2);
    });

    it('should result in an empty wishlist after removing the last item', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/wishlist/items/${productId2}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.data.items).toHaveLength(0);
    });

    it('should not remove other items when removing one', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/wishlist/items/${productId2}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      const response = await request(app.getHttpServer())
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].productId).toBe(productId);
    });

    it('should return 404 Not Found when product is not in the wishlist', async () => {
      const response = await request(app.getHttpServer())
        .delete('/api/v1/wishlist/items/66f1a2b3c4d5e6f7a8b9c999')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(WISHLIST_MESSAGES.ITEM_NOT_FOUND);
    });

    it('should return 404 when trying to remove a product that was never added', async () => {
      // productId3 was never added by any customer
      const neverAddedId = '66f1a2b3c4d5e6f7a8b9c003';

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/wishlist/items/${neverAddedId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toBe(WISHLIST_MESSAGES.ITEM_NOT_FOUND);
    });

    it('should return 404 when removing a product already removed (double-remove)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      await request(app.getHttpServer())
        .delete(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 400 Bad Request for a malformed (non-ObjectId) productId', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/wishlist/items/not-an-id')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 401 Unauthorized when no token is provided', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/wishlist/items/${productId}`)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 Forbidden when called by Admin', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should be scoped — customer 2 cannot remove an item from customer 1 wishlist', async () => {
      // Customer 2 has no wishlist yet; removing from their (empty) wishlist yields 404
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken2}`)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toBe(WISHLIST_MESSAGES.ITEM_NOT_FOUND);

      // Customer 1's wishlist must be untouched
      const customer1Wishlist = await request(app.getHttpServer())
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(customer1Wishlist.body.data.items).toHaveLength(2);
    });

    it('should allow removing a product even if it has been deactivated after being added', async () => {
      // Deactivate the product — it is already in the wishlist
      await productModel.findByIdAndUpdate(productId, { isActive: false });

      // Remove should still work — we only check product existence on ADD, not on REMOVE
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.data.items).toHaveLength(1);
    });
  });

  // ─── Full workflow ─────────────────────────────────────────────────────────

  describe('Full wishlist workflow', () => {
    it('should support the complete add → verify → remove cycle', async () => {
      // 1. GET (empty, auto-created)
      const empty = await request(app.getHttpServer())
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);
      expect(empty.body.data.items).toHaveLength(0);

      // 2. POST first product
      await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      // 3. POST second product
      await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId2}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      // 4. GET confirms two items
      const two = await request(app.getHttpServer())
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);
      expect(two.body.data.items).toHaveLength(2);

      // 5. DELETE first product
      await request(app.getHttpServer())
        .delete(`/api/v1/wishlist/items/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      // 6. GET confirms one item remaining
      const one = await request(app.getHttpServer())
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);
      expect(one.body.data.items).toHaveLength(1);
      expect(one.body.data.items[0].productId).toBe(productId2);

      // 7. Attempt duplicate add → 409
      await request(app.getHttpServer())
        .post(`/api/v1/wishlist/items/${productId2}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.CONFLICT);

      // 8. DELETE last item
      await request(app.getHttpServer())
        .delete(`/api/v1/wishlist/items/${productId2}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      // 9. GET confirms empty again
      const final = await request(app.getHttpServer())
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);
      expect(final.body.data.items).toHaveLength(0);
    });
  });
});

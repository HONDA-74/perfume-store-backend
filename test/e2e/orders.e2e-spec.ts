import { HttpStatus, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { OrderStatus } from '../../src/common/types/enums/order-status.enum';
import { PerfumeGender } from '../../src/common/types/enums/perfume-gender.enum';
import { Role } from '../../src/common/types/enums/role.enum';
import { Brand, BrandDocument } from '../../src/modules/brands/schemas/brand.schema';
import { Cart, CartDocument } from '../../src/modules/cart/schemas/cart.schema';
import { Category, CategoryDocument } from '../../src/modules/categories/schemas/category.schema';
import { ORDER_MESSAGES } from '../../src/modules/orders/constants/orders.constants';
import { Order, OrderDocument } from '../../src/modules/orders/schemas/order.schema';
import { Product, ProductDocument } from '../../src/modules/products/schemas/product.schema';
import { User, UserDocument } from '../../src/modules/users/schemas/user.schema';

describe('Orders Module (E2E)', () => {
  let app: INestApplication;
  let orderModel: Model<OrderDocument>;
  let productModel: Model<ProductDocument>;
  let categoryModel: Model<CategoryDocument>;
  let brandModel: Model<BrandDocument>;
  let userModel: Model<UserDocument>;
  let cartModel: Model<CartDocument>;
  let jwtService: JwtService;

  let customerToken: string;
  let customerToken2: string;
  let adminToken: string;

  // Deterministic sub IDs that match seeded users
  const CUSTOMER_ID = new Types.ObjectId().toHexString();
  const CUSTOMER_ID_2 = new Types.ObjectId().toHexString();
  const ADMIN_ID = new Types.ObjectId().toHexString();
  const ADDRESS_ID = new Types.ObjectId().toHexString();

  let productId: string;
  let productId2: string;
  let categoryId: string;
  let brandId: string;

  const customerPayload = {
    sub: CUSTOMER_ID,
    email: 'customer@orders-test.com',
    role: Role.CUSTOMER,
  };
  const customerPayload2 = {
    sub: CUSTOMER_ID_2,
    email: 'customer2@orders-test.com',
    role: Role.CUSTOMER,
  };
  const adminPayload = { sub: ADMIN_ID, email: 'admin@orders-test.com', role: Role.ADMIN };

  const shippingAddress = {
    label: 'Home',
    recipientName: 'Jane Doe',
    phone: '+201234567890',
    country: 'Egypt',
    city: 'Tanta',
    street: '12 Nile St.',
    postalCode: '31111',
    isDefault: true,
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

    orderModel = moduleFixture.get<Model<OrderDocument>>(getModelToken(Order.name));
    productModel = moduleFixture.get<Model<ProductDocument>>(getModelToken(Product.name));
    categoryModel = moduleFixture.get<Model<CategoryDocument>>(getModelToken(Category.name));
    brandModel = moduleFixture.get<Model<BrandDocument>>(getModelToken(Brand.name));
    userModel = moduleFixture.get<Model<UserDocument>>(getModelToken(User.name));
    cartModel = moduleFixture.get<Model<CartDocument>>(getModelToken(Cart.name));
    jwtService = moduleFixture.get<JwtService>(JwtService);

    customerToken = jwtService.sign(customerPayload);
    customerToken2 = jwtService.sign(customerPayload2);
    adminToken = jwtService.sign(adminPayload);

    // Clean up any stale null/empty-email documents left by prior crashed test runs
    await userModel.deleteMany({ $or: [{ email: null }, { email: { $exists: false } }] });
  });

  beforeEach(async () => {
    await orderModel.deleteMany({});
    await productModel.deleteMany({});
    await categoryModel.deleteMany({});
    await brandModel.deleteMany({});
    await cartModel.deleteMany({});

    const category = await categoryModel.create({
      name: 'EDP Category',
      slug: 'edp-category',
      isActive: true,
    });
    const brand = await brandModel.create({ name: 'TestBrand', slug: 'testbrand', isActive: true });
    categoryId = category.id as string;
    brandId = brand.id as string;

    const p1 = await productModel.create({
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
    const p2 = await productModel.create({
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
    productId = p1.id as string;
    productId2 = p2.id as string;

    // Insert users directly via the underlying MongoDB collection to bypass
    // Mongoose middleware that may interfere with test setup (e.g., lowercase
    // transforms) and to avoid unique-index collisions on re-runs.
    const usersCollection = userModel.collection;
    await usersCollection.deleteMany({
      _id: { $in: [new Types.ObjectId(CUSTOMER_ID), new Types.ObjectId(CUSTOMER_ID_2)] },
    });
    await usersCollection.insertMany([
      {
        _id: new Types.ObjectId(CUSTOMER_ID),
        fullName: 'Jane Doe',
        email: 'customer@orders-test.com',
        passwordHash: 'x',
        role: Role.CUSTOMER,
        isActive: true,
        isDeleted: false,
        deletedAt: null,
        addresses: [{ _id: new Types.ObjectId(ADDRESS_ID), ...shippingAddress }],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: new Types.ObjectId(CUSTOMER_ID_2),
        fullName: 'Bob Smith',
        email: 'customer2@orders-test.com',
        passwordHash: 'x',
        role: Role.CUSTOMER,
        isActive: true,
        isDeleted: false,
        deletedAt: null,
        addresses: [{ _id: new Types.ObjectId(), ...shippingAddress }],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    // Verify the insert worked
    const insertedCount = await usersCollection.countDocuments({
      _id: { $in: [new Types.ObjectId(CUSTOMER_ID), new Types.ObjectId(CUSTOMER_ID_2)] },
    });
    if (insertedCount !== 2) {
      throw new Error(`User setup failed: expected 2 users, got ${insertedCount}`);
    }
  });

  afterAll(async () => {
    await orderModel.deleteMany({});
    await productModel.deleteMany({});
    await categoryModel.deleteMany({});
    await brandModel.deleteMany({});
    await userModel.deleteMany({
      email: { $in: ['customer@orders-test.com', 'customer2@orders-test.com'] },
    });
    await cartModel.deleteMany({});
    await app.close();
  });

  /** Helper: add a product to the customer's cart. */
  const addToCart = (token: string, pId: string, qty: number) =>
    request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: pId, quantity: qty });

  /** Helper: perform checkout. */
  const checkout = (token: string, addrId: string = ADDRESS_ID) =>
    request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: addrId });

  // ─── POST /api/v1/orders ──────────────────────────────────────────────────

  describe('POST /api/v1/orders', () => {
    it('should create an order and return 201 with a complete response DTO', async () => {
      await addToCart(customerToken, productId, 2);

      const response = await checkout(customerToken).expect(HttpStatus.CREATED);

      expect(response.body.success).toBe(true);
      const data = response.body.data as Record<string, unknown>;
      expect(data.id).toBeDefined();
      expect(data.orderNumber).toMatch(/^ORD-\d{4}-\d{6}$/);
      expect(data.userId).toBe(CUSTOMER_ID);
      expect(data.status).toBe(OrderStatus.PENDING);
      expect((data.items as unknown[]).length).toBe(1);
      expect((data.items as Array<Record<string, unknown>>)[0].nameSnapshot).toBe(
        'Bleu de Chanel EDP',
      );
      expect((data.items as Array<Record<string, unknown>>)[0].priceSnapshot).toBe(120);
      expect((data.items as Array<Record<string, unknown>>)[0].quantity).toBe(2);
      expect((data.items as Array<Record<string, unknown>>)[0].lineTotal).toBe(240);
      expect(data.subtotal).toBe(240);
      expect(data.total).toBe(240);
      expect((data.shippingAddress as Record<string, unknown>).recipientName).toBe('Jane Doe');
    });

    it('should use current discountPrice as priceSnapshot', async () => {
      await productModel.findByIdAndUpdate(productId, { discountPrice: 99 });
      await addToCart(customerToken, productId, 1);

      const response = await checkout(customerToken).expect(HttpStatus.CREATED);

      expect((response.body.data.items as Array<Record<string, unknown>>)[0].priceSnapshot).toBe(
        99,
      );
    });

    it('should clear the cart after successful checkout', async () => {
      await addToCart(customerToken, productId, 2);
      await checkout(customerToken).expect(HttpStatus.CREATED);

      const cartResponse = await request(app.getHttpServer())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(cartResponse.body.data.items).toHaveLength(0);
    });

    it('should decrement product stock after checkout', async () => {
      await addToCart(customerToken, productId, 3);
      await checkout(customerToken).expect(HttpStatus.CREATED);

      const product = await productModel.findById(productId);
      expect(product?.stockQuantity).toBe(47); // 50 - 3
    });

    it('should handle multi-item checkout correctly', async () => {
      await addToCart(customerToken, productId, 2);
      await addToCart(customerToken, productId2, 1);

      const response = await checkout(customerToken).expect(HttpStatus.CREATED);

      expect((response.body.data.items as unknown[]).length).toBe(2);
      expect(response.body.data.subtotal).toBe(330); // 240 + 90
    });

    it('should return 400 when cart is empty', async () => {
      const response = await checkout(customerToken).expect(HttpStatus.BAD_REQUEST);
      expect(response.body.message).toBe(ORDER_MESSAGES.EMPTY_CART);
    });

    it('should return 400 when addressId is not a valid ObjectId', async () => {
      await addToCart(customerToken, productId, 1);

      const response = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ addressId: 'not-an-id' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 when addressId does not belong to the requesting customer', async () => {
      await addToCart(customerToken, productId, 1);

      const response = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ addressId: '66f1a2b3c4d5e6f7a8b9c999' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toBe(ORDER_MESSAGES.INVALID_ADDRESS);
    });

    it('should return 404 when a cart product is inactive at checkout time', async () => {
      await addToCart(customerToken, productId, 1);
      await productModel.findByIdAndUpdate(productId, { isActive: false });

      const response = await checkout(customerToken).expect(HttpStatus.NOT_FOUND);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 when a cart product is soft-deleted at checkout time', async () => {
      await addToCart(customerToken, productId, 1);
      await productModel.findByIdAndUpdate(productId, {
        isDeleted: true,
        isActive: false,
        deletedAt: new Date(),
      });

      const response = await checkout(customerToken).expect(HttpStatus.NOT_FOUND);
      expect(response.body.success).toBe(false);
    });

    it('should return 409 when stock decreases below cart quantity before checkout', async () => {
      await addToCart(customerToken, productId, 10);
      // Simulate another admin draining the stock
      await productModel.findByIdAndUpdate(productId, { stockQuantity: 2 });

      const response = await checkout(customerToken).expect(HttpStatus.CONFLICT);
      expect(response.body.message).toBe(ORDER_MESSAGES.INSUFFICIENT_STOCK);
    });

    it('should return 401 when no token is provided', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .send({ addressId: ADDRESS_ID })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 when called by Admin', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ addressId: ADDRESS_ID })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 400 when addressId is missing from the request body', async () => {
      await addToCart(customerToken, productId, 1);

      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({})
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should snapshot the address — changing it afterward must not affect the order', async () => {
      await addToCart(customerToken, productId, 1);
      const orderResponse = await checkout(customerToken).expect(HttpStatus.CREATED);

      // Simulate updating the user's address
      await userModel.updateOne(
        { _id: CUSTOMER_ID, 'addresses._id': ADDRESS_ID },
        { $set: { 'addresses.$.street': 'New Street 99' } },
      );

      // The stored order must still have the original street
      const reloaded = await orderModel.findById(orderResponse.body.data.id as string);
      expect(reloaded?.shippingAddress.street).toBe('12 Nile St.');
    });
  });

  // ─── GET /api/v1/orders ───────────────────────────────────────────────────

  describe('GET /api/v1/orders', () => {
    beforeEach(async () => {
      // Place one order for customer1
      await addToCart(customerToken, productId, 1);
      await checkout(customerToken);
    });

    it("should return only the requesting customer's orders", async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.totalItems).toBe(1);
    });

    it('should return an empty list for a customer with no orders', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken2}`)
        .expect(HttpStatus.OK);

      expect(response.body.data).toHaveLength(0);
    });

    it('should return all orders when called by Admin', async () => {
      // Place a second order for customer2
      await addToCart(customerToken2, productId2, 1);
      await checkout(customerToken2);

      const response = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.meta.totalItems).toBe(2);
    });

    it('should allow Admin to filter by userId', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ userId: CUSTOMER_ID })
        .expect(HttpStatus.OK);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].userId).toBe(CUSTOMER_ID);
    });

    it('should filter by status', async () => {
      const empty = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .query({ status: OrderStatus.CONFIRMED })
        .expect(HttpStatus.OK);

      expect(empty.body.data).toHaveLength(0);
    });

    it('should return all four pagination meta fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .query({ page: 1, limit: 10 })
        .expect(HttpStatus.OK);

      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(10);
      expect(response.body.meta.totalItems).toBeDefined();
      expect(response.body.meta.totalPages).toBeDefined();
    });

    it('should return 401 when no token is provided', async () => {
      await request(app.getHttpServer()).get('/api/v1/orders').expect(HttpStatus.UNAUTHORIZED);
    });
  });

  // ─── GET /api/v1/orders/:id ───────────────────────────────────────────────

  describe('GET /api/v1/orders/:id', () => {
    let orderId: string;

    beforeEach(async () => {
      await addToCart(customerToken, productId, 1);
      const res = await checkout(customerToken);
      orderId = res.body.data.id as string;
    });

    it('should return the order for the owning customer', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.data.id).toBe(orderId);
    });

    it('should return the order for Admin regardless of ownership', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.data.id).toBe(orderId);
    });

    it("should return 403 when a customer requests another customer's order", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${customerToken2}`)
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body.message).toBe(ORDER_MESSAGES.FORBIDDEN);
    });

    it('should return 404 for a valid ObjectId that does not exist', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/orders/66f1a2b3c4d5e6f7a8b9c999')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 400 for a malformed ObjectId', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/orders/not-an-id')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 401 when no token is provided', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderId}`)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return all expected DTO fields', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      const data = response.body.data as Record<string, unknown>;
      expect(data.id).toBeDefined();
      expect(data.orderNumber).toBeDefined();
      expect(data.userId).toBeDefined();
      expect(data.items).toBeDefined();
      expect(data.shippingAddress).toBeDefined();
      expect(data.subtotal).toBeDefined();
      expect(data.total).toBeDefined();
      expect(data.status).toBeDefined();
      expect(data.paymentStatus).toBeDefined();
      expect(data.placedAt).toBeDefined();
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();
    });
  });

  // ─── PATCH /api/v1/orders/:id/status ─────────────────────────────────────

  describe('PATCH /api/v1/orders/:id/status', () => {
    let orderId: string;

    beforeEach(async () => {
      await addToCart(customerToken, productId, 1);
      const res = await checkout(customerToken);
      orderId = res.body.data.id as string;
    });

    it('should update status from PENDING to CONFIRMED (Admin)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.CONFIRMED })
        .expect(HttpStatus.OK);

      expect(response.body.data.status).toBe(OrderStatus.CONFIRMED);
    });

    it('should follow the full happy-path PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED', async () => {
      const transitions = [
        OrderStatus.CONFIRMED,
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
      ];

      for (const status of transitions) {
        const res = await request(app.getHttpServer())
          .patch(`/api/v1/orders/${orderId}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status })
          .expect(HttpStatus.OK);

        expect(res.body.data.status).toBe(status);
      }
    });

    it('should return 409 for illegal transition DELIVERED → PENDING', async () => {
      // Advance to DELIVERED first
      for (const s of [
        OrderStatus.CONFIRMED,
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
      ]) {
        await request(app.getHttpServer())
          .patch(`/api/v1/orders/${orderId}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: s });
      }

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.PENDING })
        .expect(HttpStatus.CONFLICT);

      expect(response.body.message).toBe(ORDER_MESSAGES.INVALID_STATUS_TRANSITION);
    });

    it('should return 400 for an invalid status enum value', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INVALID_STATUS' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 401 when no token is provided', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .send({ status: OrderStatus.CONFIRMED })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 when called by a Customer', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ status: OrderStatus.CONFIRMED })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 404 for a valid ObjectId that does not exist', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/orders/66f1a2b3c4d5e6f7a8b9c999/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.CONFIRMED })
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  // ─── PATCH /api/v1/orders/:id/cancel ─────────────────────────────────────

  describe('PATCH /api/v1/orders/:id/cancel', () => {
    let orderId: string;

    beforeEach(async () => {
      await addToCart(customerToken, productId, 1);
      const res = await checkout(customerToken);
      orderId = res.body.data.id as string;
    });

    it('should cancel a PENDING order and return 200', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.data.status).toBe(OrderStatus.CANCELLED);
      expect(response.body.data.cancelledAt).toBeDefined();
    });

    it('should cancel a CONFIRMED order', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.CONFIRMED });

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.data.status).toBe(OrderStatus.CANCELLED);
    });

    it('should return 409 when cancelling a SHIPPED order', async () => {
      for (const s of [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED]) {
        await request(app.getHttpServer())
          .patch(`/api/v1/orders/${orderId}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: s });
      }

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.CONFLICT);

      expect(response.body.message).toBe(ORDER_MESSAGES.CANCEL_NOT_ALLOWED);
    });

    it("should return 403 when a customer tries to cancel another customer's order", async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${customerToken2}`)
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body.message).toBe(ORDER_MESSAGES.FORBIDDEN);
    });

    it('should return 401 when no token is provided', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/cancel`)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 when called by Admin', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 404 for a valid ObjectId that does not exist', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/orders/66f1a2b3c4d5e6f7a8b9c999/cancel')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 400 for a malformed ObjectId', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/orders/not-an-id/cancel')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });
});

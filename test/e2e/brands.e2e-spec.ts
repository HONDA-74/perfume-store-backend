import { HttpStatus, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { Role } from '../../src/common/types/enums/role.enum';
import { BRAND_MESSAGES } from '../../src/modules/brands/constants/brands.constants';
import { Brand, BrandDocument } from '../../src/modules/brands/schemas/brand.schema';

describe('Brands Module (E2E)', () => {
  let app: INestApplication;
  let brandModel: Model<BrandDocument>;
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

    // Wire the same global middleware stack as main.ts so filters, pipes and
    // the response interceptor behave identically to production.
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

    brandModel = moduleFixture.get<Model<BrandDocument>>(getModelToken(Brand.name));
    jwtService = moduleFixture.get<JwtService>(JwtService);

    adminToken = jwtService.sign(adminPayload);
    customerToken = jwtService.sign(customerPayload);
  });

  beforeEach(async () => {
    await brandModel.deleteMany({});
  });

  afterAll(async () => {
    await brandModel.deleteMany({});
    await app.close();
  });

  // ─── POST /api/v1/brands ──────────────────────────────────────────────────

  describe('POST /api/v1/brands', () => {
    const createDto = {
      name: 'Chanel',
      description: 'French luxury fashion house founded in 1910.',
      logoUrl: 'https://res.cloudinary.com/perfume-store/brands/chanel-logo.jpg',
      countryOfOrigin: 'France',
    };

    it('should create a brand and return 201 when called by Admin', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/brands')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createDto)
        .expect(HttpStatus.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(createDto.name);
      expect(response.body.data.slug).toBe('chanel');
      expect(response.body.data.description).toBe(createDto.description);
      expect(response.body.data.logoUrl).toBe(createDto.logoUrl);
      expect(response.body.data.countryOfOrigin).toBe(createDto.countryOfOrigin);
      expect(response.body.data.isActive).toBe(true);
      expect(response.body.data.id).toBeDefined();
    });

    it('should create a brand with only the required name field', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/brands')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Dior' })
        .expect(HttpStatus.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Dior');
      expect(response.body.data.slug).toBe('dior');
    });

    it('should generate slug from multi-word name', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/brands')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Tom Ford' })
        .expect(HttpStatus.CREATED);

      expect(response.body.data.slug).toBe('tom-ford');
    });

    it('should return 401 Unauthorized when token is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/brands')
        .send(createDto)
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 Forbidden when called by a Customer', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/brands')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(createDto)
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 Bad Request when name is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/brands')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'No name supplied' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 Bad Request when name is too short (< 2 chars)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/brands')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'X' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 Bad Request when name exceeds 80 characters', async () => {
      const longName = 'A'.repeat(81);
      const response = await request(app.getHttpServer())
        .post('/api/v1/brands')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: longName })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 Bad Request when logoUrl is not a valid URL', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/brands')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'ValidName', logoUrl: 'not-a-url' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });

    it('should return 409 Conflict when brand name already exists', async () => {
      await brandModel.create({ name: 'Chanel', slug: 'chanel', isActive: true });

      const response = await request(app.getHttpServer())
        .post('/api/v1/brands')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createDto)
        .expect(HttpStatus.CONFLICT);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(BRAND_MESSAGES.DUPLICATE_NAME);
    });
  });

  // ─── GET /api/v1/brands ───────────────────────────────────────────────────

  describe('GET /api/v1/brands', () => {
    beforeEach(async () => {
      await brandModel.create([
        {
          name: 'Chanel',
          slug: 'chanel',
          isActive: true,
          countryOfOrigin: 'France',
        },
        {
          name: 'Dior',
          slug: 'dior',
          isActive: true,
          countryOfOrigin: 'France',
        },
        {
          name: 'Inactive Brand',
          slug: 'inactive-brand',
          isActive: false,
        },
      ]);
    });

    it('should return only active brands without authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/brands')
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2); // Only active ones
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.totalItems).toBe(2);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(10);
    });

    it('should include pagination meta in response', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/brands')
        .query({ page: 1, limit: 10 })
        .expect(HttpStatus.OK);

      expect(response.body.meta.totalItems).toBeDefined();
      expect(response.body.meta.totalPages).toBeDefined();
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(10);
    });

    it('should filter by search query (case-insensitive)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/brands')
        .query({ search: 'chan' })
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].slug).toBe('chanel');
    });

    it('should return empty list when search matches nothing', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/brands')
        .query({ search: 'NonExistentBrand' })
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.totalItems).toBe(0);
    });

    it('should sort by name:asc correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/brands')
        .query({ sort: 'name:asc' })
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      const names = response.body.data.map((b: { name: string }) => b.name);
      expect(names).toEqual([...names].sort());
    });

    it('should sort by name:desc correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/brands')
        .query({ sort: 'name:desc' })
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      const names = response.body.data.map((b: { name: string }) => b.name);
      expect(names).toEqual([...names].sort().reverse());
    });

    it('should paginate results correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/brands')
        .query({ page: 1, limit: 1 })
        .expect(HttpStatus.OK);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.totalItems).toBe(2);
      expect(response.body.meta.totalPages).toBe(2);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(1);
    });

    it('should return 200 with no brands when db is empty', async () => {
      await brandModel.deleteMany({});
      const response = await request(app.getHttpServer())
        .get('/api/v1/brands')
        .expect(HttpStatus.OK);

      expect(response.body.data).toHaveLength(0);
    });
  });

  // ─── GET /api/v1/brands/:idOrSlug ─────────────────────────────────────────

  describe('GET /api/v1/brands/:idOrSlug', () => {
    let createdBrand: BrandDocument;

    beforeEach(async () => {
      createdBrand = await brandModel.create({
        name: 'Creed',
        slug: 'creed',
        description: 'British luxury perfume house.',
        countryOfOrigin: 'UK',
        isActive: true,
      });
    });

    it('should find a brand by ObjectId publicly', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/brands/${createdBrand.id}`)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Creed');
      expect(response.body.data.id).toBe(createdBrand.id);
    });

    it('should find a brand by slug publicly', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/brands/creed')
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.slug).toBe('creed');
      expect(response.body.data.id).toBe(createdBrand.id);
    });

    it('should return all brand fields in response', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/brands/creed')
        .expect(HttpStatus.OK);

      const data = response.body.data;
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Creed');
      expect(data.slug).toBe('creed');
      expect(data.description).toBe('British luxury perfume house.');
      expect(data.countryOfOrigin).toBe('UK');
      expect(data.isActive).toBe(true);
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();
    });

    it('should return 404 Not Found for a non-existent slug', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/brands/no-such-brand')
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(BRAND_MESSAGES.NOT_FOUND);
    });

    it('should return 404 Not Found for a valid ObjectId that does not exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/brands/66f1a2b3c4d5e6f7a8b9c999')
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for an inactive brand', async () => {
      const inactive = await brandModel.create({
        name: 'Inactive',
        slug: 'inactive',
        isActive: false,
      });

      await request(app.getHttpServer())
        .get(`/api/v1/brands/${inactive.id}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  // ─── PATCH /api/v1/brands/:id ─────────────────────────────────────────────

  describe('PATCH /api/v1/brands/:id', () => {
    let createdBrand: BrandDocument;

    beforeEach(async () => {
      createdBrand = await brandModel.create({
        name: 'Armani',
        slug: 'armani',
        countryOfOrigin: 'Italy',
        isActive: true,
      });
    });

    it('should update brand name and regenerate slug when called by Admin', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/brands/${createdBrand.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Giorgio Armani' })
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Giorgio Armani');
      expect(response.body.data.slug).toBe('giorgio-armani');
    });

    it('should update description without affecting name or slug', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/brands/${createdBrand.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Iconic Italian fashion brand.' })
        .expect(HttpStatus.OK);

      expect(response.body.data.description).toBe('Iconic Italian fashion brand.');
      expect(response.body.data.name).toBe('Armani');
      expect(response.body.data.slug).toBe('armani');
    });

    it('should update countryOfOrigin', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/brands/${createdBrand.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ countryOfOrigin: 'Italy' })
        .expect(HttpStatus.OK);

      expect(response.body.data.countryOfOrigin).toBe('Italy');
    });

    it('should update logoUrl with a valid URL', async () => {
      const newLogo = 'https://res.cloudinary.com/perfume/brands/armani.jpg';
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/brands/${createdBrand.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ logoUrl: newLogo })
        .expect(HttpStatus.OK);

      expect(response.body.data.logoUrl).toBe(newLogo);
    });

    it('should return 401 Unauthorized when token is missing', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/brands/${createdBrand.id}`)
        .send({ name: 'Updated' })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 Forbidden when called by a Customer', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/brands/${createdBrand.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Updated' })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 400 Bad Request for a malformed ObjectId', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/brands/not-an-object-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Valid Name' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 404 Not Found for a valid ObjectId that does not exist', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/brands/66f1a2b3c4d5e6f7a8b9c999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Valid Name' })
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 409 Conflict when new name duplicates an existing brand', async () => {
      await brandModel.create({ name: 'Prada', slug: 'prada', isActive: true });

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/brands/${createdBrand.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Prada' })
        .expect(HttpStatus.CONFLICT);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(BRAND_MESSAGES.DUPLICATE_NAME);
    });
  });

  // ─── DELETE /api/v1/brands/:id ────────────────────────────────────────────

  describe('DELETE /api/v1/brands/:id', () => {
    let createdBrand: BrandDocument;

    beforeEach(async () => {
      createdBrand = await brandModel.create({
        name: 'Versace',
        slug: 'versace',
        isActive: true,
      });
    });

    it('should soft-delete a brand and return 204 No Content when called by Admin', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/brands/${createdBrand.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NO_CONTENT);

      // Verify the document is soft-deleted in the database
      const dbBrand = await brandModel.findById(createdBrand.id);
      expect(dbBrand?.isDeleted).toBe(true);
      expect(dbBrand?.isActive).toBe(false);
      expect(dbBrand?.deletedAt).toBeInstanceOf(Date);
    });

    it('should hide soft-deleted brand from public listing', async () => {
      // Delete it first
      await request(app.getHttpServer())
        .delete(`/api/v1/brands/${createdBrand.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NO_CONTENT);

      // Brand should no longer appear in public list
      const response = await request(app.getHttpServer())
        .get('/api/v1/brands')
        .expect(HttpStatus.OK);

      expect(response.body.data).toHaveLength(0);
    });

    it('should hide soft-deleted brand from public detail lookup', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/brands/${createdBrand.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NO_CONTENT);

      await request(app.getHttpServer())
        .get(`/api/v1/brands/${createdBrand.id}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 401 Unauthorized when token is missing', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/brands/${createdBrand.id}`)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 Forbidden when called by a Customer', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/brands/${createdBrand.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 400 Bad Request for a malformed ObjectId', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/brands/not-an-object-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 404 Not Found for a valid ObjectId that does not exist', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/brands/66f1a2b3c4d5e6f7a8b9c999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 404 when trying to delete an already soft-deleted brand', async () => {
      // First delete
      await request(app.getHttpServer())
        .delete(`/api/v1/brands/${createdBrand.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NO_CONTENT);

      // Second delete — already isDeleted: true, so findOne returns null
      await request(app.getHttpServer())
        .delete(`/api/v1/brands/${createdBrand.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});

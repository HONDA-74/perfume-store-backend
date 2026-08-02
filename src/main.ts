import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { MongoExceptionFilter } from './common/filters/mongo-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { GlobalValidationPipe } from './common/pipes/validation.pipe';

/**
 * Registers Swagger per SYSTEM_ARCHITECTURE.md §7.4 — configured at
 * bootstrap-level (main.ts), not as a business config namespace. No
 * endpoints exist yet; this only establishes the document shell, Bearer
 * auth scheme, and tag groups that future modules will populate.
 */
function setupSwagger(app: NestExpressApplication, configService: ConfigService): void {
  if (!configService.get<boolean>('app.swaggerEnabled')) {
    return;
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Luxury Perfume Store API')
    .setDescription('RESTful API for a premium perfume e-commerce platform.')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addTag('Auth')
    .addTag('Users')
    .addTag('Products')
    .addTag('Categories')
    .addTag('Brands')
    .addTag('Cart')
    .addTag('Wishlist')
    .addTag('Orders')
    .addTag('Uploads')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(configService.get<string>('app.swaggerPath', 'api/docs'), app, document);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const globalPrefix = configService.get<string>('app.globalPrefix', 'api/v1');
  const bodyLimit = configService.get<string>('app.bodyLimit', '10mb');

  // NOTE (conflict resolution): API_BLUEPRINT.md declares the API "versioned
  // from day one" via the /api/v1 global prefix string itself, not via
  // Nest's built-in enableVersioning()/URI-versioning feature. Applying both
  // would double the version segment (e.g. /api/v1/v1/products). The prefix
  // below is the sole versioning mechanism, per API_BLUEPRINT.md §0 header.
  app.setGlobalPrefix(globalPrefix);

  if (configService.get<boolean>('app.trustProxy')) {
    app.set('trust proxy', 1);
  }

  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.use(helmet());
  app.use(compression());

  app.enableCors({
    origin: configService.get<string[]>('app.corsOrigin', []),
    credentials: true,
  });

  app.useGlobalPipes(new GlobalValidationPipe());

  // Registration order matters: MongoExceptionFilter handles Mongoose/driver
  // errors specifically; HttpExceptionFilter is the bare @Catch() fallback
  // that terminates every remaining path (validation, business, unexpected)
  // in the standardized envelope (AI_RULES.md §18-19).
  app.useGlobalFilters(new MongoExceptionFilter(), new HttpExceptionFilter());

  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TimeoutInterceptor(),
    new TransformResponseInterceptor(),
  );

  app.enableShutdownHooks();

  setupSwagger(app, configService);

  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}/${globalPrefix}`);
  if (configService.get<boolean>('app.swaggerEnabled')) {
    logger.log(
      `Swagger docs available at: http://localhost:${port}/${configService.get<string>('app.swaggerPath')}`,
    );
  }
  logger.log(`Environment: ${configService.get<string>('app.env')}`);
}

bootstrap();

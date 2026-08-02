import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggerMiddleware } from './common/middlewares/logger.middleware';
import { RequestIdMiddleware } from './common/middlewares/request-id.middleware';
import configuration, { validationSchema } from './config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { BrandsModule } from './modules/brands/brands.module';
import { CartModule } from './modules/cart/cart.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductsModule } from './modules/products/products.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { UsersModule } from './modules/users/users.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configuration,
      validationSchema,
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('throttler.ttl', 60) * 1000,
          limit: configService.get<number>('throttler.limit', 100),
        },
      ],
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    BrandsModule,
    CartModule,
    WishlistModule,
    OrdersModule,
    UploadsModule,
  ],
  providers: [
    /**
     * Global rate limiting (AI_RULES.md §21). Runs first in the guard chain.
     */
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    /**
     * Authentication (AI_RULES.md §23 — default deny unless explicitly
     * allowed via @Public()). AuthModule now registers the "jwt" Passport
     * strategy (modules/auth/strategies/jwt.strategy.ts), so JwtAuthGuard
     * can be safely bound globally. No controller exists yet to protect —
     * this takes effect automatically once endpoints are added in the
     * business-logic / feature phases, with zero further wiring required.
     */
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    /**
     * Authorization — must run after JwtAuthGuard so request.user is
     * already populated before role checks (AI_RULES.md §23). No-op for
     * any route without an explicit @Roles() annotation.
     */
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, LoggerMiddleware).forRoutes('*');
  }
}

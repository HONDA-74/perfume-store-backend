import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
     * Global rate limiting (AI_RULES.md §21). Stricter per-route overrides
     * (e.g. /auth/login, /auth/register) are applied via @Throttle() once
     * those endpoints are implemented in the Auth module (M2).
     *
     * Note: JwtAuthGuard/RolesGuard are intentionally NOT bound globally
     * here yet — they depend on the "jwt" Passport strategy, which is
     * registered by the Auth module in M2. Binding them now would break
     * every route before a strategy exists. See common/guards/jwt-auth.guard.ts.
     */
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, LoggerMiddleware).forRoutes('*');
  }
}

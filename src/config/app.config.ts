import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  globalPrefix: process.env.API_PREFIX ?? 'api/v1',
  trustProxy: (process.env.APP_TRUST_PROXY ?? 'false') === 'true',
  bodyLimit: process.env.BODY_LIMIT ?? '10mb',
  corsOrigin: (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  swaggerEnabled: (process.env.SWAGGER_ENABLED ?? 'true') === 'true',
  swaggerPath: process.env.SWAGGER_PATH ?? 'api/docs',
}));

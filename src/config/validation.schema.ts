import * as Joi from 'joi';

/**
 * Validates all required environment variables at application boot.
 * The process must fail fast on invalid/missing configuration rather
 * than fail silently at runtime (AI_RULES.md §24 — validate env vars at startup).
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  APP_TRUST_PROXY: Joi.boolean().default(false),
  BODY_LIMIT: Joi.string().default('10mb'),
  CORS_ORIGIN: Joi.string().allow('').default(''),

  MONGODB_URI: Joi.string().uri().required(),
  MONGODB_RETRY_ATTEMPTS: Joi.number().default(3),
  MONGODB_RETRY_DELAY: Joi.number().default(1000),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),
  JWT_ISSUER: Joi.string().default('luxury-perfume-store-api'),
  JWT_AUDIENCE: Joi.string().default('luxury-perfume-store-clients'),
  JWT_ALGORITHM: Joi.string().valid('HS256', 'HS384', 'HS512').default('HS256'),

  CLOUDINARY_CLOUD_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(),
  CLOUDINARY_UPLOAD_FOLDER: Joi.string().default('perfume-store'),

  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),
  THROTTLE_AUTH_TTL: Joi.number().default(60),
  THROTTLE_AUTH_LIMIT: Joi.number().default(5),

  SWAGGER_ENABLED: Joi.boolean().default(true),
  SWAGGER_PATH: Joi.string().default('api/docs'),
});

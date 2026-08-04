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

  // AI Recommendation module (IMPLEMENTATION_PLAN.md M11) — optional so
  // environments without Gemini/Atlas Vector Search configured yet can
  // still boot; EmbeddingService/GeminiChatService/VectorSearchService
  // fail or degrade gracefully at call time, not at startup.
  GEMINI_API_KEY: Joi.string().allow('').optional(),
  GEMINI_EMBEDDING_MODEL: Joi.string().default('text-embedding-004'),
  GEMINI_CHAT_MODEL: Joi.string().default('gemini-2.0-flash'),
  MONGODB_VECTOR_INDEX_NAME: Joi.string().default('knowledge_vector_index'),
  AI_VECTOR_TOP_K: Joi.number().default(5),
  AI_PRODUCT_TOP_K: Joi.number().default(8),
  AI_CONVERSATION_HISTORY_LIMIT: Joi.number().default(20),
  THROTTLE_AI_LIMIT: Joi.number().default(5),
  THROTTLE_AI_TTL: Joi.number().default(60),

  // Stripe Payments module (IMPLEMENTATION_PLAN.md M12) — optional so
  // environments without Stripe configured yet can still boot; PaymentsService
  // throws a clear runtime error if keys are missing when called.
  STRIPE_SECRET_KEY: Joi.string().allow('').optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().allow('').optional(),
  STRIPE_PUBLISHABLE_KEY: Joi.string().allow('').optional(),
});

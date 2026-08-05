import { registerAs } from '@nestjs/config';

/**
 * Gemini + Atlas Vector Search configuration (IMPLEMENTATION_PLAN.md M11).
 * All values validated at startup (see config/validation.schema.ts) but
 * kept optional — the AI module degrades gracefully (VectorSearchService
 * catches search failures) rather than blocking app boot in environments
 * without an Atlas Search index configured yet.
 *
 * NOTE (fix): `text-embedding-004` was retired from the `embedContent`
 * endpoint on the v1beta API and now 404s ("models/text-embedding-004 is
 * not found for API version v1beta, or is not supported for
 * embedContent"). The currently supported embedding model for this SDK
 * version (@google/generative-ai ^0.21.0) is `gemini-embedding-001`.
 */
export default registerAs('gemini', () => ({
  apiKey: process.env.GEMINI_API_KEY,
  embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001',
  chatModel: process.env.GEMINI_CHAT_MODEL ?? 'gemini-2.0-flash',
  vectorIndexName: process.env.MONGODB_VECTOR_INDEX_NAME ?? 'knowledge_vector_index',
  vectorTopK: parseInt(process.env.AI_VECTOR_TOP_K ?? '5', 10),
  productTopK: parseInt(process.env.AI_PRODUCT_TOP_K ?? '8', 10),
  historyLimit: parseInt(process.env.AI_CONVERSATION_HISTORY_LIMIT ?? '20', 10),
}));

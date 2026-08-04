import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsModule } from '../products/products.module';
import { AiController } from './controllers/ai.controller';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { Knowledge, KnowledgeSchema } from './schemas/knowledge.schema';
import { TokenUsage, TokenUsageSchema } from './schemas/token-usage.schema';
import { ConversationService } from './services/conversation.service';
import { EmbeddingService } from './services/embedding.service';
import { GeminiChatService } from './services/gemini-chat.service';
import { ProductMatcherService } from './services/product-matcher.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { RecommendationService } from './services/recommendation.service';
import { VectorSearchService } from './services/vector-search.service';

/**
 * AiModule — RAG-augmented perfume recommendation engine (IMPLEMENTATION_PLAN.md M11).
 *
 * Depends on ProductsModule's exported service only (never its schema),
 * per SYSTEM_ARCHITECTURE.md §1.2/§4.3 — products are always read live
 * from MongoDB, never duplicated into the vector store. `Knowledge` is a
 * new, AI-owned collection holding only permanent fragrance expertise.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Knowledge.name, schema: KnowledgeSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: TokenUsage.name, schema: TokenUsageSchema },
    ]),
    ProductsModule,
  ],
  controllers: [AiController],
  providers: [
    EmbeddingService,
    VectorSearchService,
    ProductMatcherService,
    PromptBuilderService,
    GeminiChatService,
    ConversationService,
    RecommendationService,
  ],
  exports: [RecommendationService],
})
export class AiModule {}

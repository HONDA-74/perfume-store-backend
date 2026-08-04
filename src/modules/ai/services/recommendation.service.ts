import { randomUUID } from 'crypto';
import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Observable } from 'rxjs';
import { PerfumeGender } from '../../../common/types/enums/perfume-gender.enum';
import { ChatRequestDto } from '../dto/chat-request.dto';
import { ChatResponseDto } from '../dto/chat-response.dto';
import { ProductRecommendationDto } from '../dto/product-recommendation.dto';
import { TokenUsage, TokenUsageDocument } from '../schemas/token-usage.schema';
import { extractPreferences } from '../utils/preference-extractor.util';
import { ConversationService } from './conversation.service';
import { EmbeddingService } from './embedding.service';
import { GeminiChatService } from './gemini-chat.service';
import { ProductMatcherService } from './product-matcher.service';
import { PromptBuilderService } from './prompt-builder.service';
import { VectorSearchService } from './vector-search.service';

/**
 * Orchestrates the full RAG pipeline (IMPLEMENTATION_PLAN.md M11 "Search
 * Pipeline"): embed query → vector-search knowledge → match live products
 * → build one combined prompt → call Gemini → strip any hallucinated
 * product → persist conversation memory.
 */
@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly vectorSearchService: VectorSearchService,
    private readonly productMatcher: ProductMatcherService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly geminiChatService: GeminiChatService,
    private readonly conversationService: ConversationService,
    private readonly configService: ConfigService,
    @InjectModel(TokenUsage.name) private readonly tokenUsageModel: Model<TokenUsageDocument>,
  ) {}

  async chat(userId: string, dto: ChatRequestDto, requestId?: string): Promise<ChatResponseDto> {
    const reqId = requestId || randomUUID();
    const totalStart = Date.now();

    const conversation = await this.conversationService.getOrCreate(userId, dto.conversationId);
    const extracted = extractPreferences(dto.message);

    const mergedDisliked = Array.from(
      new Set([...(conversation.preferences.dislikedNotes ?? []), ...extracted.dislikedNotes]),
    );
    const mergedLiked = Array.from(
      new Set([...(conversation.preferences.likedNotes ?? []), ...extracted.likedNotes]),
    );

    const embeddingStart = Date.now();
    const queryEmbedding = await this.embeddingService.embedText(dto.message);
    const embeddingLatency = Date.now() - embeddingStart;

    const vectorSearchStart = Date.now();
    const knowledge = await this.vectorSearchService.search(queryEmbedding);
    const vectorSearchLatency = Date.now() - vectorSearchStart;

    const productTopK = this.configService.get<number>('gemini.productTopK', 8);
    const rememberedGender = conversation.preferences.preferredGender as PerfumeGender | undefined;
    const products = await this.productMatcher.findMatchingProducts(
      { ...extracted, gender: extracted.gender ?? rememberedGender },
      productTopK,
    );

    const prompt = this.promptBuilder.build({
      knowledge,
      products,
      history: conversation.messages,
      currentMessage: dto.message,
      preferences: { likedNotes: mergedLiked, dislikedNotes: mergedDisliked },
    });

    const geminiStart = Date.now();
    const llmResult = await this.geminiChatService.generate(prompt);
    const geminiLatency = Date.now() - geminiStart;

    const productsById = new Map(products.map((p) => [p.id, p]));
    const recommendations: ProductRecommendationDto[] = llmResult.recommendations
      .filter((rec) => productsById.has(rec.productId))
      .map((rec) => {
        const product = productsById.get(rec.productId)!;
        return {
          productId: product.id,
          name: product.name,
          slug: product.slug,
          price: product.price,
          discountPrice: product.discountPrice,
          reason: rec.reason,
          confidenceScore: Math.min(Math.max(rec.confidenceScore ?? 0, 0), 1),
        };
      });

    await this.conversationService.appendExchange(
      conversation,
      dto.message,
      llmResult.message,
      extracted,
    );

    const totalLatency = Date.now() - totalStart;

    const promptTokens = llmResult.usageMetadata?.promptTokenCount ?? 0;
    const completionTokens = llmResult.usageMetadata?.candidatesTokenCount ?? 0;
    const totalTokens = llmResult.usageMetadata?.totalTokenCount ?? 0;
    const estimatedCost = (promptTokens * 0.075 + completionTokens * 0.3) / 1000000;

    await this.tokenUsageModel.create({
      userId: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : undefined,
      requestId: reqId,
      modelName: this.configService.get<string>('gemini.chatModel', 'gemini-2.0-flash'),
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost,
    });

    this.logger.log(
      JSON.stringify({
        message: 'AI Chat Recommendation Served',
        requestId: reqId,
        userId,
        latency: totalLatency,
        embeddingLatency,
        vectorSearchLatency,
        geminiLatency,
        totalResponseTime: totalLatency,
        promptTokenCount: promptTokens,
        completionTokenCount: completionTokens,
        totalTokenCount: totalTokens,
        estimatedCost,
        numberOfRetrievedKnowledgeChunks: knowledge.length,
        numberOfCandidateProducts: products.length,
        numberOfFinalRecommendedProducts: recommendations.length,
      }),
    );

    return {
      conversationId: conversation.id as string,
      message: llmResult.message,
      recommendations,
    };
  }

  async chatStream(
    userId: string,
    dto: ChatRequestDto,
    requestId?: string,
  ): Promise<Observable<MessageEvent>> {
    const reqId = requestId || randomUUID();
    const totalStart = Date.now();

    return new Observable<MessageEvent>((subscriber) => {
      (async () => {
        const conversation = await this.conversationService.getOrCreate(userId, dto.conversationId);
        const extracted = extractPreferences(dto.message);

        const mergedDisliked = Array.from(
          new Set([...(conversation.preferences.dislikedNotes ?? []), ...extracted.dislikedNotes]),
        );
        const mergedLiked = Array.from(
          new Set([...(conversation.preferences.likedNotes ?? []), ...extracted.likedNotes]),
        );

        const embeddingStart = Date.now();
        const queryEmbedding = await this.embeddingService.embedText(dto.message);
        const embeddingLatency = Date.now() - embeddingStart;

        const vectorSearchStart = Date.now();
        const knowledge = await this.vectorSearchService.search(queryEmbedding);
        const vectorSearchLatency = Date.now() - vectorSearchStart;

        const productTopK = this.configService.get<number>('gemini.productTopK', 8);
        const rememberedGender = conversation.preferences.preferredGender as
          PerfumeGender | undefined;
        const products = await this.productMatcher.findMatchingProducts(
          { ...extracted, gender: extracted.gender ?? rememberedGender },
          productTopK,
        );

        const prompt = this.promptBuilder.build({
          knowledge,
          products,
          history: conversation.messages,
          currentMessage: dto.message,
          preferences: { likedNotes: mergedLiked, dislikedNotes: mergedDisliked },
        });

        const geminiStart = Date.now();
        const resultStream = await this.geminiChatService.generateStream(prompt);

        let accumulatedText = '';
        for await (const chunk of resultStream.stream) {
          const text = chunk.text();
          accumulatedText += text;
          subscriber.next({ data: JSON.stringify({ chunk: text }) });
        }

        const geminiLatency = Date.now() - geminiStart;
        const response = await resultStream.response;

        const usageMetadata = response.usageMetadata;
        const promptTokens = usageMetadata?.promptTokenCount ?? 0;
        const completionTokens = usageMetadata?.candidatesTokenCount ?? 0;
        const totalTokens = usageMetadata?.totalTokenCount ?? 0;
        const estimatedCost = (promptTokens * 0.075 + completionTokens * 0.3) / 1000000;

        const llmResult = this.geminiChatService.parseResponse(accumulatedText);
        const productsById = new Map(products.map((p) => [p.id, p]));
        const recommendations: ProductRecommendationDto[] = llmResult.recommendations
          .filter((rec) => productsById.has(rec.productId))
          .map((rec) => {
            const product = productsById.get(rec.productId)!;
            return {
              productId: product.id,
              name: product.name,
              slug: product.slug,
              price: product.price,
              discountPrice: product.discountPrice,
              reason: rec.reason,
              confidenceScore: Math.min(Math.max(rec.confidenceScore ?? 0, 0), 1),
            };
          });

        await this.conversationService.appendExchange(
          conversation,
          dto.message,
          llmResult.message,
          extracted,
        );

        const totalLatency = Date.now() - totalStart;

        await this.tokenUsageModel.create({
          userId: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : undefined,
          requestId: reqId,
          modelName: this.configService.get<string>('gemini.chatModel', 'gemini-2.0-flash'),
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCost,
        });

        this.logger.log(
          JSON.stringify({
            message: 'AI Chat Stream Recommendation Served',
            requestId: reqId,
            userId,
            latency: totalLatency,
            embeddingLatency,
            vectorSearchLatency,
            geminiLatency,
            totalResponseTime: totalLatency,
            promptTokenCount: promptTokens,
            completionTokenCount: completionTokens,
            totalTokenCount: totalTokens,
            estimatedCost,
            numberOfRetrievedKnowledgeChunks: knowledge.length,
            numberOfCandidateProducts: products.length,
            numberOfFinalRecommendedProducts: recommendations.length,
          }),
        );

        subscriber.next({
          data: JSON.stringify({
            conversationId: conversation.id as string,
            message: llmResult.message,
            recommendations,
          }),
        });

        subscriber.complete();
      })().catch((err) => {
        subscriber.error(err);
      });
    });
  }
}

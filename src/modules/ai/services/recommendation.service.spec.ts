import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, toArray } from 'rxjs';
import { TokenUsage } from '../schemas/token-usage.schema';
import { ConversationService } from './conversation.service';
import { EmbeddingService } from './embedding.service';
import { GeminiChatService } from './gemini-chat.service';
import { ProductMatcherService } from './product-matcher.service';
import { PromptBuilderService } from './prompt-builder.service';
import { RecommendationService } from './recommendation.service';
import { VectorSearchService } from './vector-search.service';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let conversationService: ConversationService;
  let geminiChatService: GeminiChatService;

  const mockEmbeddingService = {
    embedText: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  };

  const mockVectorSearchService = {
    search: jest.fn().mockResolvedValue([{ title: 'Faq', content: 'Info' }]),
  };

  const mockProductMatcher = {
    findMatchingProducts: jest
      .fn()
      .mockResolvedValue([
        { id: 'p1', name: 'Perfume 1', price: 100, slug: 'p1', stockQuantity: 5 },
      ]),
  };

  const mockPromptBuilder = {
    build: jest.fn().mockReturnValue('built prompt'),
  };

  const mockGeminiChatService = {
    generate: jest.fn().mockResolvedValue({
      message: 'Here is your recommendation.',
      recommendations: [{ productId: 'p1', reason: 'Fits well', confidenceScore: 0.9 }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
    }),
    generateStream: jest.fn().mockResolvedValue({
      stream: (async function* () {
        yield { text: () => '{"message": "Here' };
        yield {
          text: () =>
            ' is your recommendation.", "recommendations": [{"productId": "p1", "reason": "Fits well", "confidenceScore": 0.9}]}',
        };
      })(),
      response: Promise.resolve({
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
      }),
    }),
    parseResponse: jest.fn().mockReturnValue({
      message: 'Here is your recommendation.',
      recommendations: [{ productId: 'p1', reason: 'Fits well', confidenceScore: 0.9 }],
    }),
  };

  const mockConversation = {
    id: 'conv1',
    _id: 'conv1',
    messages: [],
    preferences: { likedNotes: [], dislikedNotes: [] },
    save: jest.fn().mockResolvedValue(true),
  };

  const mockConversationService = {
    getOrCreate: jest.fn().mockResolvedValue(mockConversation),
    appendExchange: jest.fn().mockResolvedValue(mockConversation),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'gemini.historyLimit') return 20;
      if (key === 'gemini.productTopK') return 8;
      return defaultValue;
    }),
  };

  const mockTokenUsageModel = {
    create: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationService,
        { provide: EmbeddingService, useValue: mockEmbeddingService },
        { provide: VectorSearchService, useValue: mockVectorSearchService },
        { provide: ProductMatcherService, useValue: mockProductMatcher },
        { provide: PromptBuilderService, useValue: mockPromptBuilder },
        { provide: GeminiChatService, useValue: mockGeminiChatService },
        { provide: ConversationService, useValue: mockConversationService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getModelToken(TokenUsage.name), useValue: mockTokenUsageModel },
      ],
    }).compile();

    service = module.get<RecommendationService>(RecommendationService);
    conversationService = module.get<ConversationService>(ConversationService);
    geminiChatService = module.get<GeminiChatService>(GeminiChatService);

    jest.clearAllMocks();
  });

  describe('chat', () => {
    it('should run RAG pipeline, persist history, track token usage, and return recommendations', async () => {
      const result = await service.chat('66f1a2b3c4d5e6f7a8b9c000', {
        message: 'I want rose scent',
      });

      expect(result.message).toBe('Here is your recommendation.');
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].productId).toBe('p1');
      expect(mockTokenUsageModel.create).toHaveBeenCalled();
      expect(conversationService.appendExchange).toHaveBeenCalled();
    });
  });

  describe('chatStream', () => {
    it('should stream chunks and output final messageEvent, then complete and persist data', async () => {
      const observable = await service.chatStream('66f1a2b3c4d5e6f7a8b9c000', {
        message: 'I want rose scent',
      });
      const events = await firstValueFrom(observable.pipe(toArray()));

      expect(events.length).toBeGreaterThan(1);
      const chunks = events.slice(0, -1).map((e) => JSON.parse(e.data as string).chunk);
      expect(chunks.join('')).toContain('Here is your recommendation.');

      const finalEvent = JSON.parse(events[events.length - 1].data as string);
      expect(finalEvent.message).toBe('Here is your recommendation.');
      expect(finalEvent.recommendations).toHaveLength(1);

      expect(mockTokenUsageModel.create).toHaveBeenCalled();
      expect(conversationService.appendExchange).toHaveBeenCalled();
    });
  });
});

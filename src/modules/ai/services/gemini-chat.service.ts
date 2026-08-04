import { GoogleGenerativeAI, GenerateContentStreamResult } from '@google/generative-ai';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_MESSAGES } from '../constants/ai.constants';

export interface LlmRecommendation {
  productId: string;
  reason: string;
  confidenceScore: number;
}

export interface LlmChatResult {
  message: string;
  recommendations: LlmRecommendation[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

@Injectable()
export class GeminiChatService {
  private readonly logger = new Logger(GeminiChatService.name);
  private readonly client: GoogleGenerativeAI;

  constructor(private readonly configService: ConfigService) {
    this.client = new GoogleGenerativeAI(this.configService.get<string>('gemini.apiKey') ?? '');
  }

  async generate(prompt: string): Promise<LlmChatResult> {
    const modelName = this.configService.get<string>('gemini.chatModel', 'gemini-2.0-flash');
    const model = this.client.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' },
    });

    try {
      const result = await model.generateContent(prompt);
      const usageMetadata = result.response.usageMetadata;
      const chatResult = this.parseResponse(result.response.text());
      return {
        ...chatResult,
        usageMetadata: usageMetadata
          ? {
              promptTokenCount: usageMetadata.promptTokenCount ?? 0,
              candidatesTokenCount: usageMetadata.candidatesTokenCount ?? 0,
              totalTokenCount: usageMetadata.totalTokenCount ?? 0,
            }
          : undefined,
      };
    } catch (error) {
      this.logger.error('Gemini generation failed', (error as Error)?.stack);
      throw new InternalServerErrorException(AI_MESSAGES.GENERATION_FAILED);
    }
  }

  async generateStream(prompt: string): Promise<GenerateContentStreamResult> {
    const modelName = this.configService.get<string>('gemini.chatModel', 'gemini-2.0-flash');
    const model = this.client.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' },
    });

    try {
      return await model.generateContentStream(prompt);
    } catch (error) {
      this.logger.error('Gemini streaming generation failed', (error as Error)?.stack);
      throw new InternalServerErrorException(AI_MESSAGES.GENERATION_FAILED);
    }
  }

  parseResponse(raw: string): LlmChatResult {
    try {
      const parsed = JSON.parse(raw) as Partial<LlmChatResult>;
      return {
        message: parsed.message ?? '',
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      };
    } catch (error) {
      this.logger.warn(`Failed to parse LLM JSON response: ${(error as Error).message}`);
      // Degrade gracefully — surface the raw text as the message with no
      // recommendations, rather than failing the whole request.
      return { message: raw, recommendations: [] };
    }
  }
}

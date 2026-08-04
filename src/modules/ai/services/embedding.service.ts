import { GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly client: GoogleGenerativeAI;

  constructor(private readonly configService: ConfigService) {
    this.client = new GoogleGenerativeAI(this.configService.get<string>('gemini.apiKey') ?? '');
  }

  /** Generates a text-embedding-004 vector for RAG indexing and query embedding. */
  async embedText(text: string): Promise<number[]> {
    const modelName = this.configService.get<string>('gemini.embeddingModel', 'text-embedding-004');
    const model = this.client.getGenerativeModel({ model: modelName });

    try {
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      this.logger.error('Embedding generation failed', (error as Error)?.stack);
      throw error;
    }
  }
}

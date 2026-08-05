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

  /**
   * Generates an embedding vector for RAG indexing and query embedding.
   *
   * FIX: `text-embedding-004` is no longer served on the `embedContent`
   * endpoint (v1beta) — Google returns 404 for it. The default fallback
   * here (used only if `gemini.embeddingModel` is somehow unset) is now
   * `gemini-embedding-001`, matching the updated default in
   * config/gemini.config.ts. The model name is passed as-is to
   * `getGenerativeModel` — the SDK itself prefixes it with `models/`
   * when calling the API, so no other call-site changes are needed.
   */
  async embedText(text: string): Promise<number[]> {
    const modelName = this.configService.get<string>(
      'gemini.embeddingModel',
      'gemini-embedding-001',
    );
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

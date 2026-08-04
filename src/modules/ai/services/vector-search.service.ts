import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Knowledge, KnowledgeDocument } from '../schemas/knowledge.schema';

export interface RetrievedKnowledge {
  title: string;
  content: string;
  category: string;
  score: number;
}

@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);

  constructor(
    @InjectModel(Knowledge.name) private readonly knowledgeModel: Model<KnowledgeDocument>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * MongoDB Atlas Vector Search against the `knowledge` collection.
   * Requires the Atlas Search index documented in knowledge.schema.ts to
   * already exist — this call is a pure aggregation, no index management.
   */
  async search(queryEmbedding: number[], topK?: number): Promise<RetrievedKnowledge[]> {
    const indexName = this.configService.get<string>(
      'gemini.vectorIndexName',
      'knowledge_vector_index',
    );
    const limit = topK ?? this.configService.get<number>('gemini.vectorTopK', 5);

    try {
      const results = await this.knowledgeModel
        .aggregate([
          {
            $vectorSearch: {
              index: indexName,
              path: 'embedding',
              queryVector: queryEmbedding,
              numCandidates: limit * 15,
              limit,
            },
          },
          {
            $project: {
              _id: 0,
              title: 1,
              content: 1,
              category: '$metadata.category',
              score: { $meta: 'vectorSearchScore' },
            },
          },
        ])
        .exec();

      return results as RetrievedKnowledge[];
    } catch (error) {
      // Degrades gracefully in environments without the Atlas index
      // configured (e.g. local dev without Atlas) rather than failing the
      // whole recommendation flow.
      this.logger.warn(
        `Vector search unavailable, continuing without RAG context: ${(error as Error).message}`,
      );
      return [];
    }
  }
}

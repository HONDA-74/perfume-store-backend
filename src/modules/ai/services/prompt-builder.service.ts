import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductResponseDto } from '../../products/dto/product-response.dto';
import { AI_SYSTEM_PROMPT } from '../constants/ai.constants';
import { ConversationMessage } from '../schemas/conversation.schema';
import { RetrievedKnowledge } from './vector-search.service';

@Injectable()
export class PromptBuilderService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Assembles the final prompt in the documented order: System Prompt →
   * Retrieved RAG Knowledge → Available Products → User Conversation →
   * Current User Message.
   */
  build(params: {
    knowledge: RetrievedKnowledge[];
    products: ProductResponseDto[];
    history: ConversationMessage[];
    currentMessage: string;
    preferences: { likedNotes: string[]; dislikedNotes: string[] };
  }): string {
    const { knowledge, products, history, currentMessage, preferences } = params;

    const knowledgeBlock = knowledge.length
      ? knowledge.map((k) => `### ${k.title}\n${k.content}`).join('\n\n')
      : 'No specific fragrance knowledge retrieved for this query.';

    const productsBlock = products.length
      ? products
          .map((p) => {
            const notes = p.notes
              ? `, notes: top=[${p.notes.top.join(', ')}] middle=[${p.notes.middle.join(', ')}] base=[${p.notes.base.join(', ')}]`
              : '';
            return (
              `- id: ${p.id}, name: "${p.name}", gender: ${p.gender}, price: ${p.price}` +
              (p.discountPrice ? `, discountPrice: ${p.discountPrice}` : '') +
              `, inStock: ${p.stockQuantity > 0}` +
              notes
            );
          })
          .join('\n')
      : 'No products currently match this query in the catalog.';

    const historyLimit = this.configService.get<number>('gemini.historyLimit', 20);
    const historyBlock = history
      .slice(-historyLimit)
      .map((m) => `${m.role === 'user' ? 'Customer' : 'Consultant'}: ${m.content}`)
      .join('\n');

    const preferencesBlock =
      preferences.likedNotes.length || preferences.dislikedNotes.length
        ? `Known customer preferences — likes: [${preferences.likedNotes.join(', ')}], dislikes: [${preferences.dislikedNotes.join(', ')}]`
        : 'No stored preferences yet.';

    return [
      AI_SYSTEM_PROMPT,
      '\n=== RAG KNOWLEDGE ===',
      knowledgeBlock,
      '\n=== AVAILABLE PRODUCTS ===',
      productsBlock,
      '\n=== CUSTOMER PREFERENCES ===',
      preferencesBlock,
      '\n=== CONVERSATION HISTORY ===',
      historyBlock || '(new conversation)',
      '\n=== CURRENT CUSTOMER MESSAGE ===',
      currentMessage,
    ].join('\n');
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AI_MESSAGES } from '../constants/ai.constants';
import { ExtractedPreferences } from '../interfaces/extracted-preferences.interface';
import { Conversation, ConversationDocument } from '../schemas/conversation.schema';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
  ) {}

  async getOrCreate(userId: string, conversationId?: string): Promise<ConversationDocument> {
    if (conversationId) {
      const existing = await this.conversationModel.findOne({ _id: conversationId, userId }).exec();
      if (!existing) {
        throw new NotFoundException(AI_MESSAGES.CONVERSATION_NOT_FOUND);
      }
      return existing;
    }

    return this.conversationModel.create({ userId, messages: [], preferences: {} });
  }

  async appendExchange(
    conversation: ConversationDocument,
    userMessage: string,
    assistantMessage: string,
    extracted: ExtractedPreferences,
  ): Promise<ConversationDocument> {
    conversation.messages.push(
      {
        role: 'user',
        content: userMessage,
        createdAt: new Date(),
      } as ConversationDocument['messages'][number],
      {
        role: 'assistant',
        content: assistantMessage,
        createdAt: new Date(),
      } as ConversationDocument['messages'][number],
    );

    conversation.preferences.likedNotes = Array.from(
      new Set([...(conversation.preferences.likedNotes ?? []), ...extracted.likedNotes]),
    );
    conversation.preferences.dislikedNotes = Array.from(
      new Set([...(conversation.preferences.dislikedNotes ?? []), ...extracted.dislikedNotes]),
    );
    if (extracted.gender) {
      conversation.preferences.preferredGender = extracted.gender;
    }

    await conversation.save();

    this.logger.log(`Conversation updated (id=${conversation.id})`);

    return conversation;
  }
}

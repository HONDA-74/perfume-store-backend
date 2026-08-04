import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseSchema } from '../../../database/base/base.schema';

export type KnowledgeDocument = Knowledge & Document;

@Schema({ _id: false })
export class KnowledgeMetadata {
  @Prop({ required: true, trim: true })
  category!: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ trim: true })
  source?: string;
}
export const KnowledgeMetadataSchema = SchemaFactory.createForClass(KnowledgeMetadata);

/**
 * `knowledge` collection — permanent fragrance-expertise RAG corpus
 * (IMPLEMENTATION_PLAN.md M11). Explicitly NEVER contains products —
 * products are always read live from the `products` collection via
 * ProductsService at request time (products change frequently; this
 * collection does not).
 */
@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc: unknown, ret: Record<string, unknown>) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.embedding; // never exposed to API consumers
      return ret;
    },
  },
})
export class Knowledge extends BaseSchema {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true })
  content!: string;

  /** text-embedding-004 output vector (768 dimensions). */
  @Prop({ type: [Number], required: true })
  embedding!: number[];

  @Prop({ type: KnowledgeMetadataSchema, required: true })
  metadata!: KnowledgeMetadata;

  createdAt!: Date;
  updatedAt!: Date;
}

export const KnowledgeSchema = SchemaFactory.createForClass(Knowledge);

KnowledgeSchema.index({ 'metadata.category': 1 });

/*
 * The Atlas Search vector index itself ('knowledge_vector_index' by
 * default — see config/gemini.config.ts) CANNOT be created via a Mongoose
 * schema-level index; it must be created once via the Atlas UI/CLI with a
 * definition equivalent to:
 *
 * {
 *   "fields": [
 *     { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
 *     { "type": "filter", "path": "metadata.category" }
 *   ]
 * }
 *
 * This is an infrastructure/Atlas-console concern (AI_RULES.md §42 —
 * DB migration strategy requires explicit permission), documented here
 * rather than automated.
 */

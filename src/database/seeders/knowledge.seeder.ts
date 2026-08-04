/* eslint-disable no-console */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../app.module';
import { Knowledge, KnowledgeDocument } from '../../modules/ai/schemas/knowledge.schema';
import { EmbeddingService } from '../../modules/ai/services/embedding.service';

/**
 * One-time / re-runnable CLI seeder that embeds every markdown file in
 * src/ai/knowledge/ and upserts the resulting chunks into the `knowledge`
 * collection (IMPLEMENTATION_PLAN.md M11). Chunking is by `##` heading —
 * each second-level section becomes one embeddable document, keeping
 * chunks small enough for precise retrieval.
 *
 * Run via: npm run seed:knowledge
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  const knowledgeModel = app.get<Model<KnowledgeDocument>>(getModelToken(Knowledge.name));
  const embeddingService = app.get(EmbeddingService);

  const knowledgeDir = join(__dirname, '../../ai/knowledge');
  const files = readdirSync(knowledgeDir).filter((f) => f.endsWith('.md'));

  let totalChunks = 0;

  for (const file of files) {
    const category = file.replace('.md', '');
    const raw = readFileSync(join(knowledgeDir, file), 'utf-8');
    const chunks = splitIntoChunks(raw);

    for (const chunk of chunks) {
      const embedding = await embeddingService.embedText(`${chunk.title}\n${chunk.content}`);

      await knowledgeModel.updateOne(
        { title: chunk.title, 'metadata.category': category },
        {
          $set: {
            title: chunk.title,
            content: chunk.content,
            embedding,
            metadata: { category, tags: [category], source: file },
          },
        },
        { upsert: true },
      );

      totalChunks += 1;
    }

    console.log(`Seeded ${chunks.length} chunk(s) from ${file}`);
  }

  console.log(`Knowledge seeding complete — ${totalChunks} total chunks.`);
  await app.close();
}

function splitIntoChunks(markdown: string): Array<{ title: string; content: string }> {
  const sections = markdown.split(/\n(?=##\s)/g);
  return sections
    .map((section) => {
      const lines = section.trim().split('\n');
      const heading = lines[0]?.replace(/^#+\s*/, '').trim() || 'Untitled';
      const content = lines.slice(1).join('\n').trim();
      return { title: heading, content: content || heading };
    })
    .filter((chunk) => chunk.content.length > 0);
}

bootstrap().catch((error) => {
  console.error('Knowledge seeding failed:', error);
  process.exit(1);
});

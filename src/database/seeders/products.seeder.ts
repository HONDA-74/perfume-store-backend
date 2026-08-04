/* eslint-disable no-console */
import { createHash } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../app.module';
import { PerfumeGender } from '../../common/types/enums/perfume-gender.enum';
import { slugify } from '../../common/utils/slugify.util';
import { Brand, BrandDocument } from '../../modules/brands/schemas/brand.schema';
import { Category, CategoryDocument } from '../../modules/categories/schemas/category.schema';
import { ProductConcentration } from '../../modules/products/enums/product-concentration.enum';
import { Product, ProductDocument } from '../../modules/products/schemas/product.schema';
import { BRANDS_SEED_DATA } from './data/brands.seed-data';
import { CATEGORIES_SEED_DATA } from './data/categories.seed-data';
import { NOTES_BY_FAMILY } from './data/notes-by-family';
import { PRODUCTS_SEED_DATA, ProductSeedInput } from './data/products.seed-data';

/**
 * Idempotent product-catalog seeder (dev/demo data only).
 *
 * Reuses the existing, unmodified Product/Category/Brand schemas and
 * DTO-independent field set from DATABASE_DESIGN.md §4.2-§4.4 — no schema,
 * service, controller, or DTO in `modules/products`, `modules/categories`,
 * or `modules/brands` is touched.
 *
 * Idempotency contract:
 * - Brands/Categories are upserted by `name` (their unique index).
 * - Products are upserted by `sku`, which is deterministically derived
 *   from brand + product name (never random), so re-running this script
 *   updates the same documents instead of creating duplicates.
 * - Every randomized field (stock, discount, featured flag, rating) is
 *   derived from a seeded hash of the product's slug rather than
 *   `Math.random()`, so repeated runs are fully idempotent — the same
 *   input data always produces the same output values.
 *
 * Image note: real, verifiably-stable, non-watermarked, high-resolution
 * URLs from Fragrantica/Sephora/Notino cannot be safely hardcoded here —
 * they are third-party product photography (copyright/hotlink-stability
 * risk) and cannot be confirmed reachable without live scraping, which
 * this script does not perform. Instead, each product gets 4 deterministic,
 * stable, HTTPS, 1200x1200 placeholder images (picsum.photos, seeded by
 * slug) so the catalog is visually populated end-to-end. Replace via the
 * existing Uploads module (SYSTEM_ARCHITECTURE.md §12) once real assets
 * are licensed.
 *
 * Run via: npm run seed:products
 */

const IMAGE_SIZE = 1200;
const IMAGES_PER_PRODUCT = 4;

function seededRandom(seedText: string): () => number {
  // Deterministic PRNG (mulberry32) seeded from a hash of the input string —
  // guarantees identical output across repeated runs of the same input.
  let seed = parseInt(createHash('sha256').update(seedText).digest('hex').slice(0, 8), 16);
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSku(brand: string, name: string): string {
  const hash = createHash('sha1')
    .update(`${brand}::${name}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  const brandCode =
    brand
      .replace(/[^A-Za-z]/g, '')
      .slice(0, 3)
      .toUpperCase() || 'GEN';
  return `${brandCode}-${hash}`;
}

function buildImages(slug: string): string[] {
  return Array.from(
    { length: IMAGES_PER_PRODUCT },
    (_, index) => `https://picsum.photos/seed/${slug}-${index + 1}/${IMAGE_SIZE}/${IMAGE_SIZE}`,
  );
}

function buildDescription(entry: ProductSeedInput): { description: string; shortSummary: string } {
  const shortSummary = `${entry.brand} ${entry.name.replace(entry.brand, '').trim()} — a ${entry.concentration} fragrance for ${entry.gender.toLowerCase()} wear.`;
  const description =
    `${entry.name} by ${entry.brand} is a ${entry.concentration} fragrance in the ` +
    `${entry.family.replace(/_/g, ' ').toLowerCase()} family, bottled at ${entry.sizeMl}ml. ` +
    `${shortSummary} Fragrance-family note profile below reflects typical accords for this style ` +
    `and should be verified against a licensed source for the exact real formula.`;
  return { description, shortSummary };
}

async function upsertBrands(brandModel: Model<BrandDocument>): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const brand of BRANDS_SEED_DATA) {
    const slug = slugify(brand.name);
    const doc = await brandModel
      .findOneAndUpdate(
        { name: brand.name },
        {
          $set: {
            name: brand.name,
            slug,
            description: brand.description,
            countryOfOrigin: brand.countryOfOrigin,
            isActive: true,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    map.set(brand.name, (doc.id as string) ?? doc._id.toString());
  }

  return map;
}

async function upsertCategories(
  categoryModel: Model<CategoryDocument>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const category of CATEGORIES_SEED_DATA) {
    const slug = slugify(category.name);
    const doc = await categoryModel
      .findOneAndUpdate(
        { name: category.name },
        {
          $set: {
            name: category.name,
            slug,
            description: category.description,
            isActive: true,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    map.set(category.name, (doc.id as string) ?? doc._id.toString());
  }

  return map;
}

async function upsertProducts(
  productModel: Model<ProductDocument>,
  brandIdByName: Map<string, string>,
  categoryIdByName: Map<string, string>,
): Promise<{ created: number; updated: number; skipped: string[] }> {
  let created = 0;
  let updated = 0;
  const skipped: string[] = [];

  for (const entry of PRODUCTS_SEED_DATA) {
    const brandId = brandIdByName.get(entry.brand);
    const categoryId = categoryIdByName.get(entry.category);

    if (!brandId || !categoryId) {
      skipped.push(
        `${entry.name} (missing brand/category reference: ${entry.brand} / ${entry.category})`,
      );
      continue;
    }

    const slug = slugify(entry.name);
    const sku = buildSku(entry.brand, entry.name);
    const random = seededRandom(sku);

    const stockQuantity = 5 + Math.floor(random() * 195); // 5..199
    const isFeatured = random() < 0.15; // ~15% featured, deterministic per product
    const hasDiscount = random() < 0.3; // ~30% of products carry a discount
    const discountPrice = hasDiscount
      ? Math.round(entry.basePrice * (0.75 + random() * 0.15) * 100) / 100 // 15-25% off
      : undefined;
    const ratingAverage = Math.round((3.5 + random() * 1.5) * 10) / 10; // 3.5..5.0
    const ratingCount = 5 + Math.floor(random() * 995); // 5..999

    const notes = NOTES_BY_FAMILY[entry.family];
    const { description } = buildDescription(entry);

    const gender = entry.gender as keyof typeof PerfumeGender;
    const concentration = entry.concentration as keyof typeof ProductConcentration;

    const existing = await productModel.findOne({ sku }).exec();

    await productModel
      .findOneAndUpdate(
        { sku },
        {
          $set: {
            name: entry.name,
            slug,
            categoryId,
            brandId,
            description,
            price: entry.basePrice,
            discountPrice,
            stockQuantity,
            gender: PerfumeGender[gender],
            concentration: ProductConcentration[concentration],
            sizeMl: entry.sizeMl,
            notes,
            images: buildImages(slug),
            isActive: true,
            isFeatured,
            ratingAverage,
            ratingCount,
          },
          $setOnInsert: { isDeleted: false, deletedAt: null },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  return { created, updated, skipped };
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const brandModel = app.get<Model<BrandDocument>>(getModelToken(Brand.name));
    const categoryModel = app.get<Model<CategoryDocument>>(getModelToken(Category.name));
    const productModel = app.get<Model<ProductDocument>>(getModelToken(Product.name));

    console.log(`Seeding ${BRANDS_SEED_DATA.length} brands...`);
    const brandIdByName = await upsertBrands(brandModel);

    console.log(`Seeding ${CATEGORIES_SEED_DATA.length} categories...`);
    const categoryIdByName = await upsertCategories(categoryModel);

    console.log(`Seeding ${PRODUCTS_SEED_DATA.length} products...`);
    const { created, updated, skipped } = await upsertProducts(
      productModel,
      brandIdByName,
      categoryIdByName,
    );

    console.log(
      `Product seeding complete — ${created} created, ${updated} updated, ${skipped.length} skipped.`,
    );

    if (skipped.length > 0) {
      console.warn('Skipped entries (missing brand/category reference):');
      skipped.forEach((line) => console.warn(`  - ${line}`));
    }
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  console.error('Product seeding failed:', error);
  process.exit(1);
});

/**
 * Category taxonomy (products.seeder.ts data layer). Mixes concentration-
 * based categories (Eau de Parfum, etc.) with family/format-based
 * categories (Floral Fragrances, Gift Sets, etc.), matching how the
 * documented `categories` collection is used across DATABASE_DESIGN.md §4.2
 * (classification, not gender). No schema field added — only real Category
 * documents inserted through the existing, unmodified Category schema.
 */
export interface CategorySeedInput {
  name: string;
  description?: string;
}

export const CATEGORIES_SEED_DATA: CategorySeedInput[] = [
  {
    name: 'Eau de Parfum',
    description:
      'Higher-concentration fragrances (15-20% aromatic compounds) with strong longevity.',
  },
  {
    name: 'Eau de Toilette',
    description: 'Lighter, everyday-strength fragrances (5-15% aromatic compounds).',
  },
  {
    name: 'Eau de Cologne',
    description:
      'Light, refreshing fragrances (2-5% aromatic compounds), ideal for a quick refresh.',
  },
  {
    name: 'Extrait de Parfum',
    description: 'Highest-concentration fragrances with maximum longevity and depth.',
  },
  { name: 'Parfum', description: 'Rich, long-lasting pure parfum concentration.' },
  {
    name: 'Niche Fragrances',
    description: 'Exclusive, small-batch fragrances from specialist perfume houses.',
  },
  {
    name: 'Designer Fragrances',
    description: 'Fragrances from established global fashion houses.',
  },
  { name: 'Gift Sets', description: 'Curated fragrance gift sets and travel duos.' },
  { name: 'Travel Size', description: 'Compact, travel-friendly fragrance formats.' },
  {
    name: 'Body Mist',
    description: 'Lightweight, low-concentration fragrance mists for daily wear.',
  },
  {
    name: 'Oud Collection',
    description: 'Fragrances built around agarwood (oud), a Middle Eastern perfumery staple.',
  },
  {
    name: 'Floral Fragrances',
    description: 'Fragrances centered on rose, jasmine, and other floral accords.',
  },
  { name: 'Woody Fragrances', description: 'Fragrances built on cedar, sandalwood, and vetiver.' },
  { name: 'Fresh & Aquatic', description: 'Light, marine, and citrus-forward fragrances.' },
  { name: 'Oriental & Amber', description: 'Warm, resinous, spice-and-amber-driven fragrances.' },
  { name: 'Citrus Fragrances', description: 'Bright, zesty fragrances built on citrus top notes.' },
];

/**
 * Representative note profiles per fragrance family archetype. These are
 * generic, factual fragrance-note groupings (not copied text from any
 * third-party source) used to populate the existing `notes` embedded field
 * on Product (product-notes.schema.ts) with realistic, family-consistent
 * data. Exact note lists for a specific real product should be verified
 * against a licensed source before being treated as authoritative.
 */
export type FragranceFamily =
  | 'CITRUS'
  | 'FRESH_AQUATIC'
  | 'WOODY'
  | 'ORIENTAL_AMBER'
  | 'FLORAL'
  | 'GOURMAND'
  | 'LEATHER_SMOKY'
  | 'GREEN_AROMATIC'
  | 'CHYPRE'
  | 'OUD';

export interface NoteProfile {
  top: string[];
  middle: string[];
  base: string[];
}

export const NOTES_BY_FAMILY: Record<FragranceFamily, NoteProfile> = {
  CITRUS: {
    top: ['Bergamot', 'Lemon', 'Mandarin'],
    middle: ['Neroli', 'Petitgrain'],
    base: ['White Musk', 'Cedar'],
  },
  FRESH_AQUATIC: {
    top: ['Sea Notes', 'Grapefruit', 'Bergamot'],
    middle: ['Lavender', 'Sage'],
    base: ['Musk', 'Ambergris'],
  },
  WOODY: {
    top: ['Bergamot', 'Pink Pepper'],
    middle: ['Cedar', 'Vetiver'],
    base: ['Sandalwood', 'Patchouli'],
  },
  ORIENTAL_AMBER: {
    top: ['Saffron', 'Cardamom'],
    middle: ['Amber', 'Rose'],
    base: ['Vanilla', 'Labdanum'],
  },
  FLORAL: {
    top: ['Pear', 'Bergamot'],
    middle: ['Jasmine', 'Rose', 'Peony'],
    base: ['Musk', 'Sandalwood'],
  },
  GOURMAND: {
    top: ['Bitter Almond', 'Bergamot'],
    middle: ['Praline', 'Coffee'],
    base: ['Vanilla', 'Tonka Bean'],
  },
  LEATHER_SMOKY: {
    top: ['Pink Pepper', 'Saffron'],
    middle: ['Leather', 'Iris'],
    base: ['Tobacco', 'Oud'],
  },
  GREEN_AROMATIC: {
    top: ['Basil', 'Lavender'],
    middle: ['Geranium', 'Clary Sage'],
    base: ['Vetiver', 'Oakmoss'],
  },
  CHYPRE: {
    top: ['Bergamot', 'Mandarin'],
    middle: ['Rose', 'Jasmine'],
    base: ['Oakmoss', 'Patchouli'],
  },
  OUD: { top: ['Saffron', 'Rose'], middle: ['Oud', 'Amber'], base: ['Sandalwood', 'Musk'] },
};

/**
 * Real perfume houses (products.seeder.ts data layer).
 * Not a schema — plain data consumed by the seeder, upserted into the
 * existing `brands` collection via BrandsModule's own Brand schema
 * (unmodified). AI_RULES.md §7 YAGNI: no speculative fields added.
 */
export interface BrandSeedInput {
  name: string;
  countryOfOrigin?: string;
  description?: string;
}

export const BRANDS_SEED_DATA: BrandSeedInput[] = [
  {
    name: 'Chanel',
    countryOfOrigin: 'France',
    description: 'French luxury fashion and fragrance house founded in 1910.',
  },
  {
    name: 'Dior',
    countryOfOrigin: 'France',
    description: 'French luxury goods house founded by Christian Dior in 1946.',
  },
  {
    name: 'Tom Ford',
    countryOfOrigin: 'United States',
    description: 'American luxury fashion house known for bold, niche-style fragrances.',
  },
  {
    name: 'Yves Saint Laurent',
    countryOfOrigin: 'France',
    description: 'French luxury house founded in 1961.',
  },
  {
    name: 'Giorgio Armani',
    countryOfOrigin: 'Italy',
    description: 'Italian luxury fashion house founded in 1975.',
  },
  {
    name: 'Versace',
    countryOfOrigin: 'Italy',
    description: 'Italian luxury fashion house founded in 1978.',
  },
  {
    name: 'Gucci',
    countryOfOrigin: 'Italy',
    description: 'Italian luxury fashion house founded in 1921.',
  },
  {
    name: 'Prada',
    countryOfOrigin: 'Italy',
    description: 'Italian luxury fashion house founded in 1913.',
  },
  {
    name: 'Burberry',
    countryOfOrigin: 'United Kingdom',
    description: 'British luxury fashion house founded in 1856.',
  },
  {
    name: 'Dolce & Gabbana',
    countryOfOrigin: 'Italy',
    description: 'Italian luxury fashion house founded in 1985.',
  },
  {
    name: 'Calvin Klein',
    countryOfOrigin: 'United States',
    description: 'American fashion house known for minimalist, accessible fragrances.',
  },
  {
    name: 'Hugo Boss',
    countryOfOrigin: 'Germany',
    description: 'German luxury fashion house founded in 1924.',
  },
  {
    name: 'Paco Rabanne',
    countryOfOrigin: 'Spain/France',
    description: 'Fashion house founded by designer Paco Rabanne in 1966.',
  },
  {
    name: 'Jean Paul Gaultier',
    countryOfOrigin: 'France',
    description: 'French fashion house known for avant-garde bottle design.',
  },
  {
    name: 'Lancome',
    countryOfOrigin: 'France',
    description: 'French luxury perfume and cosmetics house founded in 1935.',
  },
  {
    name: 'Givenchy',
    countryOfOrigin: 'France',
    description: 'French luxury fashion house founded in 1952.',
  },
  {
    name: 'Bvlgari',
    countryOfOrigin: 'Italy',
    description: 'Italian luxury jewelry and fragrance house founded in 1884.',
  },
  {
    name: 'Carolina Herrera',
    countryOfOrigin: 'Venezuela/United States',
    description: 'Fashion house founded by designer Carolina Herrera in 1980.',
  },
  {
    name: 'Narciso Rodriguez',
    countryOfOrigin: 'United States',
    description: 'American fashion designer known for musky, skin-scent signatures.',
  },
  {
    name: 'Viktor & Rolf',
    countryOfOrigin: 'Netherlands',
    description: 'Dutch fashion design duo founded in 1993.',
  },
  {
    name: 'Thierry Mugler',
    countryOfOrigin: 'France',
    description: 'French fashion house known for bold, gourmand fragrances.',
  },
  {
    name: 'Issey Miyake',
    countryOfOrigin: 'Japan',
    description: 'Japanese fashion house known for minimalist, aquatic fragrances.',
  },
  {
    name: 'Montblanc',
    countryOfOrigin: 'Germany',
    description: 'German luxury goods house known for accessible men’s fragrances.',
  },
  {
    name: 'Azzaro',
    countryOfOrigin: 'France',
    description: 'French fashion house founded by Loris Azzaro in 1967.',
  },
  {
    name: 'Creed',
    countryOfOrigin: 'United Kingdom/France',
    description: 'Niche perfume house founded in 1760.',
  },
  {
    name: 'Maison Francis Kurkdjian',
    countryOfOrigin: 'France',
    description: 'Niche perfume house founded by perfumer Francis Kurkdjian in 2009.',
  },
  {
    name: 'Parfums de Marly',
    countryOfOrigin: 'France',
    description: 'Niche perfume house inspired by 18th-century French royal court perfumery.',
  },
  {
    name: 'Xerjoff',
    countryOfOrigin: 'Italy',
    description: 'Italian niche perfume house founded in 2003.',
  },
  {
    name: 'Ajmal',
    countryOfOrigin: 'United Arab Emirates',
    description: 'Middle Eastern perfume house specializing in oud and attars.',
  },
  {
    name: "Victoria's Secret",
    countryOfOrigin: 'United States',
    description: 'American lifestyle brand known for body mists and fine fragrance mists.',
  },
];

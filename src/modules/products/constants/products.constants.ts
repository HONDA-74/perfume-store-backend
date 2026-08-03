/**
 * Module-owned constants (AI_RULES.md §35 — avoid magic strings). Kept
 * inside `modules/products/constants/`, not `common/`, since these are
 * feature-specific (SYSTEM_ARCHITECTURE.md §6.2).
 */
export const PRODUCT_MESSAGES = {
  NOT_FOUND: 'Product not found.',
  DUPLICATE_SKU: 'A product with this SKU already exists.',
  DUPLICATE_SLUG: 'A product with this slug already exists.',
  CATEGORY_NOT_FOUND: 'Referenced category does not exist.',
  BRAND_NOT_FOUND: 'Referenced brand does not exist.',
  INVALID_DISCOUNT_PRICE: 'discountPrice must be less than price.',
  INSUFFICIENT_STOCK: 'Insufficient stock for the requested operation.',
} as const;

/** Maps whitelisted QueryProductDto.sort values to Mongoose sort specs. */
export const PRODUCT_SORT_FIELD_MAP: Record<string, Record<string, 1 | -1>> = {
  'price:asc': { price: 1 },
  'price:desc': { price: -1 },
  'createdAt:desc': { createdAt: -1 },
  'name:asc': { name: 1 },
};

/**
 * Default listing order when no `sort` is provided — featured products
 * first, then newest, per API_BLUEPRINT.md §1.6 ("Products defaults to
 * isFeatured first, then newest").
 */
export const PRODUCT_DEFAULT_SORT: Record<string, 1 | -1> = { isFeatured: -1, createdAt: -1 };

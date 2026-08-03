import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { PaginatedResult } from '../../../common/types/interfaces/paginated-result.interface';
import { buildPaginationMeta, normalizePagination } from '../../../common/utils/pagination.util';
import { slugify } from '../../../common/utils/slugify.util';
import { BRAND_MESSAGES, BRAND_SORT_FIELD_MAP } from '../constants/brands.constants';
import { BrandResponseDto } from '../dto/brand-response.dto';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { QueryBrandDto } from '../dto/query-brand.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';
import { Brand, BrandDocument } from '../schemas/brand.schema';

/**
 * Business logic for the Brands module (IMPLEMENTATION_PLAN.md M4).
 *
 * Brands is a foundational leaf module (SYSTEM_ARCHITECTURE.md §4.2): it
 * never imports or calls ProductsService. The orphan-check documented in
 * API_BLUEPRINT.md §6 ("409 if soft-deleting would orphan active products")
 * is intentionally deferred until the Products module exists — identical
 * rationale to `CategoriesService.remove()`. Implementing it now would
 * require Brands to reach into a module it must never depend on, per the
 * Module Dependency Map (SYSTEM_ARCHITECTURE.md §4.2/§4.3). This is flagged
 * explicitly rather than silently omitted, per IMPLEMENTATION_PLAN.md M4's
 * own note on this exact dependency direction.
 *
 * `BrandsService` is exported by `BrandsModule` specifically so that, once
 * built, `ProductsModule` can inject it — never the reverse.
 */
@Injectable()
export class BrandsService {
  private readonly logger = new Logger(BrandsService.name);

  constructor(@InjectModel(Brand.name) private readonly brandModel: Model<BrandDocument>) {}

  async create(dto: CreateBrandDto): Promise<BrandResponseDto> {
    const slug = slugify(dto.name);

    await this.assertNameAndSlugAvailable(dto.name, slug);

    const created = await this.brandModel.create({
      name: dto.name,
      slug,
      description: dto.description,
      logoUrl: dto.logoUrl,
      countryOfOrigin: dto.countryOfOrigin,
    });

    this.logger.log(`Brand created (id=${created.id}, slug=${slug})`);

    return BrandResponseDto.fromEntity(created);
  }

  /**
   * Public listing: only active, non-deleted brands are ever returned
   * (DATABASE_DESIGN.md §6 — inactive brands are "excluded from public
   * listing"). Same admin-visibility caveat as `CategoriesService.findAll`
   * — no optional-authentication mechanism exists yet in `common/` to
   * distinguish an authenticated Admin caller on this currently-`@Public()`
   * route without altering shared auth infrastructure (out of scope per
   * AI_RULES.md §42).
   */
  async findAll(query: QueryBrandDto): Promise<PaginatedResult<BrandResponseDto>> {
    const { page, limit, skip } = normalizePagination(query.page, query.limit);

    const filter: Record<string, unknown> = { isDeleted: false, isActive: true };

    if (query.search) {
      // No text index is defined for `brands` (DATABASE_DESIGN.md §4.3
      // only indexes `slug`/`name` for uniqueness) — a case-insensitive
      // regex against the already-indexed, low-cardinality `name` field is
      // an acceptable, documented trade-off for this small, foundational
      // collection (AI_RULES.md §29 targets unindexed-field regex scans).
      filter.name = { $regex: this.escapeRegex(query.search), $options: 'i' };
    }

    const sort = BRAND_SORT_FIELD_MAP[query.sort ?? 'createdAt:desc'];

    const [documents, totalItems] = await Promise.all([
      this.brandModel.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      this.brandModel.countDocuments(filter).exec(),
    ]);

    return {
      items: documents.map((doc) => BrandResponseDto.fromEntity(doc)),
      meta: buildPaginationMeta(page, limit, totalItems),
    };
  }

  async findOneByIdOrSlug(idOrSlug: string): Promise<BrandResponseDto> {
    const filter = isValidObjectId(idOrSlug)
      ? { _id: idOrSlug, isDeleted: false, isActive: true }
      : { slug: idOrSlug, isDeleted: false, isActive: true };

    const brand = await this.brandModel.findOne(filter).exec();

    if (!brand) {
      throw new NotFoundException(BRAND_MESSAGES.NOT_FOUND);
    }

    return BrandResponseDto.fromEntity(brand);
  }

  async update(id: string, dto: UpdateBrandDto): Promise<BrandResponseDto> {
    const brand = await this.brandModel.findOne({ _id: id, isDeleted: false }).exec();

    if (!brand) {
      throw new NotFoundException(BRAND_MESSAGES.NOT_FOUND);
    }

    if (dto.name && dto.name !== brand.name) {
      const newSlug = slugify(dto.name);
      await this.assertNameAndSlugAvailable(dto.name, newSlug, brand.id);
      brand.name = dto.name;
      brand.slug = newSlug;
    }

    if (dto.description !== undefined) {
      brand.description = dto.description;
    }

    if (dto.logoUrl !== undefined) {
      brand.logoUrl = dto.logoUrl;
    }

    if (dto.countryOfOrigin !== undefined) {
      brand.countryOfOrigin = dto.countryOfOrigin;
    }

    await brand.save();

    this.logger.log(`Brand updated (id=${brand.id})`);

    return BrandResponseDto.fromEntity(brand);
  }

  /**
   * Soft delete only — no hard delete exists (DATABASE_DESIGN.md §6,
   * cross-module rule §11.6 in API_BLUEPRINT.md).
   *
   * NOTE: the documented orphan-check ("409 if soft-deleting would orphan
   * active products") is deliberately NOT performed here — see the class
   * doc comment above. When Products (M6) is built, this method should
   * inject `ProductsService` following the same one-directional resolution
   * flagged in `CategoriesService.remove()` and IMPLEMENTATION_PLAN.md M4,
   * and throw `ConflictException` when `countByBrandId(id) > 0`.
   */
  async remove(id: string): Promise<void> {
    const brand = await this.brandModel.findOne({ _id: id, isDeleted: false }).exec();

    if (!brand) {
      throw new NotFoundException(BRAND_MESSAGES.NOT_FOUND);
    }

    brand.isDeleted = true;
    brand.deletedAt = new Date();
    brand.isActive = false;
    await brand.save();

    this.logger.log(`Brand soft-deleted (id=${brand.id})`);
  }

  private async assertNameAndSlugAvailable(
    name: string,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const filter: Record<string, unknown> = {
      isDeleted: false,
      $or: [{ name }, { slug }],
    };

    if (excludeId) {
      filter._id = { $ne: excludeId };
    }

    const duplicate = await this.brandModel.findOne(filter).exec();

    if (duplicate) {
      const isNameConflict = duplicate.name === name;
      throw new ConflictException(
        isNameConflict ? BRAND_MESSAGES.DUPLICATE_NAME : BRAND_MESSAGES.DUPLICATE_SLUG,
      );
    }
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

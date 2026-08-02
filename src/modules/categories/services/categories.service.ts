import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { PaginatedResult } from '../../../common/types/interfaces/paginated-result.interface';
import { buildPaginationMeta, normalizePagination } from '../../../common/utils/pagination.util';
import { slugify } from '../../../common/utils/slugify.util';
import { CATEGORY_MESSAGES, CATEGORY_SORT_FIELD_MAP } from '../constants/categories.constants';
import { CategoryResponseDto } from '../dto/category-response.dto';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { QueryCategoryDto } from '../dto/query-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { Category, CategoryDocument } from '../schemas/category.schema';

/**
 * Business logic for the Categories module (IMPLEMENTATION_PLAN.md M4).
 *
 * Categories is a foundational leaf module (SYSTEM_ARCHITECTURE.md §4.2):
 * it never imports or calls ProductsService/BrandsService. The orphan-check
 * documented in API_BLUEPRINT.md §5 ("409 if soft-deleting would orphan
 * active products") is intentionally deferred until the Products module
 * exists — see the comment on `remove()` below. Implementing it now would
 * require Categories to reach into a module it must never depend on, per
 * the Module Dependency Map (SYSTEM_ARCHITECTURE.md §4.2/§4.3). This is
 * flagged explicitly rather than silently omitted, per
 * IMPLEMENTATION_PLAN.md M4's own note on this exact dependency direction.
 *
 * `CategoriesService` is exported by `CategoriesModule` specifically so
 * that, once built, `ProductsModule` can inject it — never the reverse.
 */
@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const slug = slugify(dto.name);

    await this.assertNameAndSlugAvailable(dto.name, slug);

    const created = await this.categoryModel.create({
      name: dto.name,
      slug,
      description: dto.description,
      imageUrl: dto.imageUrl,
    });

    this.logger.log(`Category created (id=${created.id}, slug=${slug})`);

    return CategoryResponseDto.fromEntity(created);
  }

  /**
   * Public listing: only active, non-deleted categories are ever returned
   * (DATABASE_DESIGN.md §6 — inactive categories are "excluded from public
   * listing"). No optional-authentication mechanism exists yet in
   * `common/` to distinguish an authenticated Admin caller on this
   * currently-`@Public()` route without altering shared auth
   * infrastructure (out of scope per AI_RULES.md §42), so the
   * admin-sees-inactive nuance noted in API_BLUEPRINT.md §5 is not applied
   * here — flagged for a follow-up once an optional-auth guard exists.
   */
  async findAll(query: QueryCategoryDto): Promise<PaginatedResult<CategoryResponseDto>> {
    const { page, limit, skip } = normalizePagination(query.page, query.limit);

    const filter: Record<string, unknown> = { isDeleted: false, isActive: true };

    if (query.search) {
      // No text index is defined for `categories` (DATABASE_DESIGN.md §4.2
      // only indexes `slug`/`name` for uniqueness) — a case-insensitive
      // regex against the already-indexed, low-cardinality `name` field is
      // an acceptable, documented trade-off for this small, foundational
      // collection (AI_RULES.md §29 targets unindexed-field regex scans).
      filter.name = { $regex: this.escapeRegex(query.search), $options: 'i' };
    }

    const sort = CATEGORY_SORT_FIELD_MAP[query.sort ?? 'createdAt:desc'];

    const [documents, totalItems] = await Promise.all([
      this.categoryModel.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      this.categoryModel.countDocuments(filter).exec(),
    ]);

    return {
      items: documents.map((doc) => CategoryResponseDto.fromEntity(doc)),
      meta: buildPaginationMeta(page, limit, totalItems),
    };
  }

  async findOneByIdOrSlug(idOrSlug: string): Promise<CategoryResponseDto> {
    const filter = isValidObjectId(idOrSlug)
      ? { _id: idOrSlug, isDeleted: false, isActive: true }
      : { slug: idOrSlug, isDeleted: false, isActive: true };

    const category = await this.categoryModel.findOne(filter).exec();

    if (!category) {
      throw new NotFoundException(CATEGORY_MESSAGES.NOT_FOUND);
    }

    return CategoryResponseDto.fromEntity(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    const category = await this.categoryModel.findOne({ _id: id, isDeleted: false }).exec();

    if (!category) {
      throw new NotFoundException(CATEGORY_MESSAGES.NOT_FOUND);
    }

    if (dto.name && dto.name !== category.name) {
      const newSlug = slugify(dto.name);
      await this.assertNameAndSlugAvailable(dto.name, newSlug, category.id);
      category.name = dto.name;
      category.slug = newSlug;
    }

    if (dto.description !== undefined) {
      category.description = dto.description;
    }

    if (dto.imageUrl !== undefined) {
      category.imageUrl = dto.imageUrl;
    }

    await category.save();

    this.logger.log(`Category updated (id=${category.id})`);

    return CategoryResponseDto.fromEntity(category);
  }

  /**
   * Soft delete only — no hard delete exists (DATABASE_DESIGN.md §6,
   * cross-module rule §11.6 in API_BLUEPRINT.md).
   *
   * NOTE: the documented orphan-check ("409 if soft-deleting would orphan
   * active products") is deliberately NOT performed here — see the class
   * doc comment above. When Products (M6) is built, this method should
   * inject `ProductsService` (via `forwardRef`-free, one-directional
   * constructor injection — Products already depends on Categories, so
   * Categories importing ProductsService directly would be circular; the
   * documented resolution is a service-to-service call agreed upon at that
   * time, exactly as flagged in IMPLEMENTATION_PLAN.md M4) and throw
   * `ConflictException` when `countByCategoryId(id) > 0`.
   */
  async remove(id: string): Promise<void> {
    const category = await this.categoryModel.findOne({ _id: id, isDeleted: false }).exec();

    if (!category) {
      throw new NotFoundException(CATEGORY_MESSAGES.NOT_FOUND);
    }

    category.isDeleted = true;
    category.deletedAt = new Date();
    category.isActive = false;
    await category.save();

    this.logger.log(`Category soft-deleted (id=${category.id})`);
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

    const duplicate = await this.categoryModel.findOne(filter).exec();

    if (duplicate) {
      const isNameConflict = duplicate.name === name;
      throw new ConflictException(
        isNameConflict ? CATEGORY_MESSAGES.DUPLICATE_NAME : CATEGORY_MESSAGES.DUPLICATE_SLUG,
      );
    }
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

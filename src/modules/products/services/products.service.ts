import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, FilterQuery, isValidObjectId, Model, UpdateQuery } from 'mongoose';
import { PaginatedResult } from '../../../common/types/interfaces/paginated-result.interface';
import { buildPaginationMeta, normalizePagination } from '../../../common/utils/pagination.util';
import { slugify } from '../../../common/utils/slugify.util';
import { BrandsService } from '../../brands/services/brands.service';
import { CategoriesService } from '../../categories/services/categories.service';
import {
  PRODUCT_DEFAULT_SORT,
  PRODUCT_MESSAGES,
  PRODUCT_SORT_FIELD_MAP,
} from '../constants/products.constants';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductResponseDto } from '../dto/product-response.dto';
import { QueryProductDto } from '../dto/query-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { UpdateStockDto } from '../dto/update-stock.dto';
import { StockOperation } from '../enums/stock-operation.enum';
import { Product, ProductDocument } from '../schemas/product.schema';

/**
 * Business logic for the Products module (IMPLEMENTATION_PLAN.md M6).
 *
 * Products depends on Categories and Brands (service-to-service only, per
 * SYSTEM_ARCHITECTURE.md §4.2 "Products: Categories, Brands, Uploads") to
 * validate references before create/update — never imports their schemas
 * directly (SYSTEM_ARCHITECTURE.md §1.2/§4.3). CategoriesService/BrandsService
 * are exported by their modules specifically for this one-directional
 * injection, mirroring the pattern already documented in their own service
 * files.
 *
 * Uploads (M5) is still a placeholder module (IMPLEMENTATION_PLAN.md), so
 * `images` are accepted as plain URL strings on the DTO for now — no
 * UploadsService injection exists yet. Flagged under Deferred Work.
 */
@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    private readonly categoriesService: CategoriesService,
    private readonly brandsService: BrandsService,
  ) {}

  async create(dto: CreateProductDto): Promise<ProductResponseDto> {
    await this.assertCategoryAndBrandExist(dto.categoryId, dto.brandId);
    this.assertDiscountPriceValid(dto.price, dto.discountPrice);

    const slug = slugify(dto.name);
    const sku = dto.sku.toUpperCase();
    await this.assertSkuAndSlugAvailable(sku, slug);

    const created = await this.productModel.create({
      name: dto.name,
      slug,
      sku,
      categoryId: dto.categoryId,
      brandId: dto.brandId,
      description: dto.description,
      price: dto.price,
      discountPrice: dto.discountPrice,
      stockQuantity: dto.stockQuantity,
      gender: dto.gender,
      concentration: dto.concentration,
      sizeMl: dto.sizeMl,
      notes: dto.notes,
      images: dto.images ?? [],
      isFeatured: dto.isFeatured ?? false,
    });

    this.logger.log(`Product created (id=${created.id}, sku=${sku})`);

    return ProductResponseDto.fromEntity(created);
  }

  /**
   * Public listing: only active, non-deleted products are ever returned
   * (DATABASE_DESIGN.md §6). Same documented limitation as
   * CategoriesService.findAll/BrandsService.findAll — no optional-
   * authentication mechanism exists yet in `common/` to give an
   * authenticated Admin caller visibility into inactive products on this
   * `@Public()` route without altering shared auth infrastructure (out of
   * scope per AI_RULES.md §42). Flagged under Deferred Work.
   */
  async findAll(query: QueryProductDto): Promise<PaginatedResult<ProductResponseDto>> {
    const { page, limit, skip } = normalizePagination(query.page, query.limit);

    const filter: FilterQuery<ProductDocument> = { isDeleted: false, isActive: true };

    if (query.categoryId) {
      filter.categoryId = query.categoryId;
    }

    if (query.brandId) {
      filter.brandId = query.brandId;
    }

    if (query.gender) {
      filter.gender = query.gender;
    }

    if (query.isFeatured !== undefined) {
      filter.isFeatured = query.isFeatured;
    }

    if (query.inStock) {
      filter.stockQuantity = { $gt: 0 };
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter.price = {
        ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
      };
    }

    if (query.search) {
      // Mongo text index on { name, description } (DATABASE_DESIGN.md §4.4)
      // — never an unindexed regex scan (AI_RULES.md §29).
      filter.$text = { $search: query.search };
    }

    const sort = query.sort ? PRODUCT_SORT_FIELD_MAP[query.sort] : PRODUCT_DEFAULT_SORT;

    const [documents, totalItems] = await Promise.all([
      this.productModel.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    return {
      items: documents.map((doc) => ProductResponseDto.fromEntity(doc)),
      meta: buildPaginationMeta(page, limit, totalItems),
    };
  }

  async findOneByIdOrSlug(idOrSlug: string): Promise<ProductResponseDto> {
    const filter: FilterQuery<ProductDocument> = isValidObjectId(idOrSlug)
      ? { _id: idOrSlug, isDeleted: false, isActive: true }
      : { slug: idOrSlug, isDeleted: false, isActive: true };

    const product = await this.productModel.findOne(filter).exec();

    if (!product) {
      throw new NotFoundException(PRODUCT_MESSAGES.NOT_FOUND);
    }

    return ProductResponseDto.fromEntity(product);
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductResponseDto> {
    const product = await this.productModel.findOne({ _id: id, isDeleted: false }).exec();

    if (!product) {
      throw new NotFoundException(PRODUCT_MESSAGES.NOT_FOUND);
    }

    if (dto.categoryId || dto.brandId) {
      await this.assertCategoryAndBrandExist(
        dto.categoryId ?? product.categoryId.toString(),
        dto.brandId ?? product.brandId.toString(),
      );
    }

    const effectivePrice = dto.price ?? product.price;
    const effectiveDiscount =
      dto.discountPrice !== undefined ? dto.discountPrice : product.discountPrice;
    this.assertDiscountPriceValid(effectivePrice, effectiveDiscount);

    if (dto.name && dto.name !== product.name) {
      const newSlug = slugify(dto.name);
      await this.assertSkuAndSlugAvailable(
        dto.sku ? dto.sku.toUpperCase() : product.sku,
        newSlug,
        product.id,
      );
      product.name = dto.name;
      product.slug = newSlug;
    } else if (dto.sku && dto.sku.toUpperCase() !== product.sku) {
      await this.assertSkuAndSlugAvailable(dto.sku.toUpperCase(), product.slug, product.id);
      product.sku = dto.sku.toUpperCase();
    }

    if (dto.categoryId !== undefined) {
      product.set('categoryId', dto.categoryId);
    }
    if (dto.brandId !== undefined) {
      product.set('brandId', dto.brandId);
    }
    if (dto.description !== undefined) {
      product.description = dto.description;
    }
    if (dto.price !== undefined) {
      product.price = dto.price;
    }
    if (dto.discountPrice !== undefined) {
      product.discountPrice = dto.discountPrice;
    }
    if (dto.stockQuantity !== undefined) {
      product.stockQuantity = dto.stockQuantity;
    }
    if (dto.gender !== undefined) {
      product.gender = dto.gender;
    }
    if (dto.concentration !== undefined) {
      product.concentration = dto.concentration;
    }
    if (dto.sizeMl !== undefined) {
      product.sizeMl = dto.sizeMl;
    }
    if (dto.notes !== undefined) {
      product.notes = {
        top: dto.notes.top ?? product.notes?.top ?? [],
        middle: dto.notes.middle ?? product.notes?.middle ?? [],
        base: dto.notes.base ?? product.notes?.base ?? [],
      };
    }
    if (dto.images !== undefined) {
      product.images = dto.images;
    }
    if (dto.isFeatured !== undefined) {
      product.isFeatured = dto.isFeatured;
    }

    await product.save();

    this.logger.log(`Product updated (id=${product.id})`);

    return ProductResponseDto.fromEntity(product);
  }

  /**
   * Soft delete only — no hard delete exists (DATABASE_DESIGN.md §6,
   * cross-module rule API_BLUEPRINT.md §11.6).
   */
  async remove(id: string): Promise<void> {
    const product = await this.productModel.findOne({ _id: id, isDeleted: false }).exec();

    if (!product) {
      throw new NotFoundException(PRODUCT_MESSAGES.NOT_FOUND);
    }

    product.isDeleted = true;
    product.deletedAt = new Date();
    product.isActive = false;
    await product.save();

    this.logger.log(`Product soft-deleted (id=${product.id})`);
  }

  /**
   * Atomic stock mutation (IMPLEMENTATION_PLAN.md M6 — "Mongo $inc with a
   * guard condition", never read-then-write). DECREMENT's guard condition
   * (`stockQuantity: { $gte: quantity }`) is enforced by MongoDB itself in
   * the same operation, eliminating the race window between a stock check
   * and the write (PROJECT_CONTEXT.md — "Inventory cannot become negative").
   */
  async updateStock(id: string, dto: UpdateStockDto): Promise<ProductResponseDto> {
    const baseFilter: FilterQuery<ProductDocument> = { _id: id, isDeleted: false };
    let filter: FilterQuery<ProductDocument> = baseFilter;
    let update: UpdateQuery<ProductDocument>;

    switch (dto.operation) {
      case StockOperation.SET:
        update = { $set: { stockQuantity: dto.quantity } };
        break;
      case StockOperation.INCREMENT:
        update = { $inc: { stockQuantity: dto.quantity } };
        break;
      case StockOperation.DECREMENT:
        filter = { ...baseFilter, stockQuantity: { $gte: dto.quantity } };
        update = { $inc: { stockQuantity: -dto.quantity } };
        break;
    }

    const updated = await this.productModel.findOneAndUpdate(filter, update, { new: true }).exec();

    if (!updated) {
      const exists = await this.productModel.exists(baseFilter);
      if (!exists) {
        throw new NotFoundException(PRODUCT_MESSAGES.NOT_FOUND);
      }
      throw new ConflictException(PRODUCT_MESSAGES.INSUFFICIENT_STOCK);
    }

    this.logger.log(`Product stock updated (id=${updated.id}, operation=${dto.operation})`);

    return ProductResponseDto.fromEntity(updated);
  }

  /**
   * Session-aware atomic DECREMENT used exclusively by OrdersService during
   * checkout transactions. The guard condition (`stockQuantity: { $gte: quantity }`)
   * is evaluated by MongoDB atomically within the session — two concurrent
   * checkouts racing for the last unit will both attempt this operation, but
   * only one will find `stockQuantity >= quantity` true; the other receives
   * null and the transaction aborts with a 409.
   *
   * Accepts an optional `ClientSession` so the decrement participates in the
   * same ACID boundary as order creation and cart clearing — if any later step
   * in the transaction fails, MongoDB rolls back this decrement automatically,
   * eliminating the need for manual compensation logic.
   *
   * Returns the updated product document (or null if the guard condition
   * prevented the update), letting the caller decide how to handle the failure.
   */
  async decrementStockAtomic(
    id: string,
    quantity: number,
    session: ClientSession | null,
  ): Promise<ProductDocument | null> {
    /*
     * WHY this filter: isActive && !isDeleted re-validates that the product
     * is still purchasable at the moment the transaction commits — not just
     * when the cart was populated. A product deactivated after the customer
     * added it to cart will fail here, inside the transaction, preventing
     * the order from committing.
     */
    const filter: FilterQuery<ProductDocument> = {
      _id: id,
      isDeleted: false,
      isActive: true,
      stockQuantity: { $gte: quantity },
    };

    const queryOpts: Record<string, unknown> = { new: true };
    if (session) {
      queryOpts.session = session;
    }

    return this.productModel
      .findOneAndUpdate(filter, { $inc: { stockQuantity: -quantity } }, queryOpts)
      .exec();
  }

  /**
   * Validates product existence and purchasability within a session.
   * Used by OrdersService to re-verify the product is active and in
   * stock before committing a checkout transaction.
   */
  async findActiveProductForCheckout(
    id: string,
    session: ClientSession | null,
  ): Promise<ProductDocument | null> {
    const query = this.productModel.findOne({ _id: id, isDeleted: false, isActive: true });
    if (session) {
      query.session(session);
    }
    return query.exec();
  }

  private async assertCategoryAndBrandExist(categoryId: string, brandId: string): Promise<void> {
    await Promise.all([
      this.categoriesService.findOneByIdOrSlug(categoryId).catch(() => {
        throw new NotFoundException(PRODUCT_MESSAGES.CATEGORY_NOT_FOUND);
      }),
      this.brandsService.findOneByIdOrSlug(brandId).catch(() => {
        throw new NotFoundException(PRODUCT_MESSAGES.BRAND_NOT_FOUND);
      }),
    ]);
  }

  /**
   * 400 Bad Request per API_BLUEPRINT.md §4 ("400 — invalid price/stock
   * values"), distinct from the 409s reserved for duplicate SKU/slug and
   * negative-stock stock operations.
   */
  private assertDiscountPriceValid(price: number, discountPrice?: number): void {
    if (discountPrice !== undefined && discountPrice !== null && discountPrice >= price) {
      throw new BadRequestException(PRODUCT_MESSAGES.INVALID_DISCOUNT_PRICE);
    }
  }

  private async assertSkuAndSlugAvailable(
    sku: string,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const filter: FilterQuery<ProductDocument> = {
      isDeleted: false,
      $or: [{ sku }, { slug }],
    };

    if (excludeId) {
      filter._id = { $ne: excludeId };
    }

    const duplicate = await this.productModel.findOne(filter).exec();

    if (duplicate) {
      const isSkuConflict = duplicate.sku === sku;
      throw new ConflictException(
        isSkuConflict ? PRODUCT_MESSAGES.DUPLICATE_SKU : PRODUCT_MESSAGES.DUPLICATE_SLUG,
      );
    }
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../../../common/pipes/parse-object-id.pipe';
import { Role } from '../../../common/types/enums/role.enum';
import { PaginatedResult } from '../../../common/types/interfaces/paginated-result.interface';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductResponseDto } from '../dto/product-response.dto';
import { PRODUCT_SORT_WHITELIST, QueryProductDto } from '../dto/query-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { UpdateStockDto } from '../dto/update-stock.dto';
import { ProductsService } from '../services/products.service';

/**
 * Product endpoints per API_BLUEPRINT.md §4 — the six documented routes,
 * no additions. Structurally follows CategoriesController/BrandsController
 * (IMPLEMENTATION_PLAN.md M6 — "follow the exact architecture already used
 * in Categories and Brands").
 *
 * Auth posture: GET routes are `@Public()`; POST/PATCH/DELETE rely on the
 * globally-registered `JwtAuthGuard` → `RolesGuard` chain (default deny,
 * AI_RULES.md §23) plus an explicit `@Roles(Role.ADMIN)` annotation.
 */
@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List products (public, active only, paginated)' })
  @ApiQuery({ name: 'search', required: false, description: 'Text search on name/description.' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'brandId', required: false })
  @ApiQuery({ name: 'gender', required: false })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'isFeatured', required: false, type: Boolean })
  @ApiQuery({ name: 'inStock', required: false, type: Boolean })
  @ApiQuery({ name: 'sort', required: false, enum: PRODUCT_SORT_WHITELIST })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Paginated product list.' })
  findAll(@Query() query: QueryProductDto): Promise<PaginatedResult<ProductResponseDto>> {
    return this.productsService.findAll(query);
  }

  @Public()
  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get a single product by ID or slug' })
  @ApiParam({ name: 'idOrSlug', description: 'Mongo ObjectId or product slug.' })
  @ApiOkResponse({ description: 'Product found.', type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  findOne(@Param('idOrSlug') idOrSlug: string): Promise<ProductResponseDto> {
    return this.productsService.findOneByIdOrSlug(idOrSlug);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a product (Admin only)' })
  @ApiCreatedResponse({ description: 'Product created.', type: ProductResponseDto })
  @ApiConflictResponse({ description: 'Duplicate SKU/slug.' })
  @ApiNotFoundResponse({ description: 'Referenced category or brand not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Caller does not have the Admin role.' })
  create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a product (Admin only)' })
  @ApiParam({ name: 'id', description: 'Mongo ObjectId of the product.' })
  @ApiOkResponse({ description: 'Product updated.', type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Product, category, or brand not found.' })
  @ApiConflictResponse({ description: 'Duplicate SKU/slug.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Caller does not have the Admin role.' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft-delete a product (Admin only)' })
  @ApiParam({ name: 'id', description: 'Mongo ObjectId of the product.' })
  @ApiNoContentResponse({ description: 'Product soft-deleted.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Caller does not have the Admin role.' })
  async remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    await this.productsService.remove(id);
  }

  @Patch(':id/stock')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update product stock (SET/INCREMENT/DECREMENT, Admin only)' })
  @ApiParam({ name: 'id', description: 'Mongo ObjectId of the product.' })
  @ApiOkResponse({ description: 'Stock updated.', type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiConflictResponse({ description: 'Resulting stock would go negative.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Caller does not have the Admin role.' })
  updateStock(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateStockDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.updateStock(id, dto);
  }
}

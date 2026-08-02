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
import { CategoryResponseDto } from '../dto/category-response.dto';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { CATEGORY_SORT_WHITELIST } from '../dto/query-category.dto';
import { QueryCategoryDto } from '../dto/query-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CategoriesService } from '../services/categories.service';

/**
 * Category endpoints per API_BLUEPRINT.md §5 — exactly the five documented
 * routes, no additions (task scope explicitly forbids inventing endpoints).
 *
 * Auth posture: GET routes are `@Public()`; POST/PATCH/DELETE rely on the
 * globally-registered `JwtAuthGuard` → `RolesGuard` chain (default deny,
 * AI_RULES.md §23) plus an explicit `@Roles(Role.ADMIN)` annotation.
 */
@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List categories (public, active only, paginated)' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Case-insensitive search on category name.',
  })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'sort', required: false, enum: CATEGORY_SORT_WHITELIST })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Paginated category list.' })
  findAll(@Query() query: QueryCategoryDto): Promise<PaginatedResult<CategoryResponseDto>> {
    return this.categoriesService.findAll(query);
  }

  @Public()
  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get a single category by ID or slug' })
  @ApiParam({ name: 'idOrSlug', description: 'Mongo ObjectId or category slug.' })
  @ApiOkResponse({ description: 'Category found.', type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  findOne(@Param('idOrSlug') idOrSlug: string): Promise<CategoryResponseDto> {
    return this.categoriesService.findOneByIdOrSlug(idOrSlug);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a category (Admin only)' })
  @ApiCreatedResponse({ description: 'Category created.', type: CategoryResponseDto })
  @ApiConflictResponse({ description: 'Duplicate category name or slug.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  create(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a category (Admin only)' })
  @ApiParam({ name: 'id', description: 'Mongo ObjectId of the category.' })
  @ApiOkResponse({ description: 'Category updated.', type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  @ApiConflictResponse({ description: 'Duplicate category name or slug.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft-delete a category (Admin only)' })
  @ApiParam({ name: 'id', description: 'Mongo ObjectId of the category.' })
  @ApiNoContentResponse({ description: 'Category soft-deleted.' })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  async remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    await this.categoriesService.remove(id);
  }
}

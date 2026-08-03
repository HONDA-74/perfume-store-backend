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
import { BrandResponseDto } from '../dto/brand-response.dto';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { BRAND_SORT_WHITELIST, QueryBrandDto } from '../dto/query-brand.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';
import { BrandsService } from '../services/brands.service';

/**
 * Brand endpoints per API_BLUEPRINT.md §6 — exactly the five documented
 * routes, no additions (task scope explicitly forbids inventing endpoints).
 *
 * Auth posture: GET routes are `@Public()`; POST/PATCH/DELETE rely on the
 * globally-registered `JwtAuthGuard` → `RolesGuard` chain (default deny,
 * AI_RULES.md §23) plus an explicit `@Roles(Role.ADMIN)` annotation.
 *
 * Structurally identical to CategoriesController per IMPLEMENTATION_PLAN.md
 * M4 ("built together because they are near-duplicates in shape").
 */
@ApiTags('Brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List brands (public, active only, paginated)' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Case-insensitive search on brand name.',
  })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'sort', required: false, enum: BRAND_SORT_WHITELIST })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Paginated brand list.' })
  findAll(@Query() query: QueryBrandDto): Promise<PaginatedResult<BrandResponseDto>> {
    return this.brandsService.findAll(query);
  }

  @Public()
  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get a single brand by ID or slug' })
  @ApiParam({ name: 'idOrSlug', description: 'Mongo ObjectId or brand slug.' })
  @ApiOkResponse({ description: 'Brand found.', type: BrandResponseDto })
  @ApiNotFoundResponse({ description: 'Brand not found.' })
  findOne(@Param('idOrSlug') idOrSlug: string): Promise<BrandResponseDto> {
    return this.brandsService.findOneByIdOrSlug(idOrSlug);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a brand (Admin only)' })
  @ApiCreatedResponse({ description: 'Brand created.', type: BrandResponseDto })
  @ApiConflictResponse({ description: 'Duplicate brand name or slug.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  create(@Body() dto: CreateBrandDto): Promise<BrandResponseDto> {
    return this.brandsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a brand (Admin only)' })
  @ApiParam({ name: 'id', description: 'Mongo ObjectId of the brand.' })
  @ApiOkResponse({ description: 'Brand updated.', type: BrandResponseDto })
  @ApiNotFoundResponse({ description: 'Brand not found.' })
  @ApiConflictResponse({ description: 'Duplicate brand name or slug.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateBrandDto,
  ): Promise<BrandResponseDto> {
    return this.brandsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft-delete a brand (Admin only)' })
  @ApiParam({ name: 'id', description: 'Mongo ObjectId of the brand.' })
  @ApiNoContentResponse({ description: 'Brand soft-deleted.' })
  @ApiNotFoundResponse({ description: 'Brand not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  async remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    await this.brandsService.remove(id);
  }
}

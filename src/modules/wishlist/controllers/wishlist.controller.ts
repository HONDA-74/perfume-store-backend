import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../../../common/pipes/parse-object-id.pipe';
import { Role } from '../../../common/types/enums/role.enum';
import { WishlistResponseDto } from '../dto/wishlist-response.dto';
import { WishlistService } from '../services/wishlist.service';

/**
 * Wishlist endpoints per API_BLUEPRINT.md §8 — exactly the three documented
 * routes, no additions. Structurally follows CartController
 * (IMPLEMENTATION_PLAN.md M8 — same architecture as Categories/Brands/
 * Products/Cart).
 *
 * Auth posture: every route is Auth (Customer) per the API_BLUEPRINT.md §8
 * table — no `@Public()` routes exist in this module.
 */
@ApiTags('Wishlist')
@ApiBearerAuth('access-token')
@Controller('wishlist')
@Roles(Role.CUSTOMER)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: "Get the caller's wishlist (auto-created if none exists)" })
  @ApiOkResponse({ description: 'Wishlist retrieved.', type: WishlistResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Caller does not have the Customer role.' })
  getWishlist(@CurrentUser('sub') userId: string): Promise<WishlistResponseDto> {
    return this.wishlistService.getWishlist(userId);
  }

  @Post('items/:productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add a product to the wishlist' })
  @ApiParam({ name: 'productId', description: 'Mongo ObjectId of the product.' })
  @ApiOkResponse({ description: 'Item added.', type: WishlistResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiConflictResponse({ description: 'Product already present in wishlist.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Caller does not have the Customer role.' })
  addItem(
    @CurrentUser('sub') userId: string,
    @Param('productId', ParseObjectIdPipe) productId: string,
  ): Promise<WishlistResponseDto> {
    return this.wishlistService.addItem(userId, productId);
  }

  @Delete('items/:productId')
  @ApiOperation({ summary: 'Remove a product from the wishlist' })
  @ApiParam({ name: 'productId', description: 'Mongo ObjectId of the product.' })
  @ApiOkResponse({ description: 'Item removed.', type: WishlistResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found in wishlist.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Caller does not have the Customer role.' })
  removeItem(
    @CurrentUser('sub') userId: string,
    @Param('productId', ParseObjectIdPipe) productId: string,
  ): Promise<WishlistResponseDto> {
    return this.wishlistService.removeItem(userId, productId);
  }
}

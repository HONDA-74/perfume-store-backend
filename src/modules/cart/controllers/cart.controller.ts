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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
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
import { AddCartItemDto } from '../dto/add-cart-item.dto';
import { CartResponseDto } from '../dto/cart-response.dto';
import { UpdateCartItemDto } from '../dto/update-cart-item.dto';
import { CartService } from '../services/cart.service';

/**
 * Cart endpoints per API_BLUEPRINT.md §7 — exactly the five documented
 * routes, no additions. Structurally follows ProductsController
 * (IMPLEMENTATION_PLAN.md M7 — same architecture as Categories/Brands/Products).
 *
 * Auth posture: every route is Auth (Customer) per the API_BLUEPRINT.md §7
 * table — no `@Public()` routes exist in this module. Relies on the
 * globally-registered `JwtAuthGuard` → `RolesGuard` chain (default deny,
 * AI_RULES.md §23) plus an explicit `@Roles(Role.CUSTOMER)` annotation.
 */
@ApiTags('Cart')
@ApiBearerAuth('access-token')
@Controller('cart')
@Roles(Role.CUSTOMER)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: "Get the caller's cart (auto-created if none exists)" })
  @ApiOkResponse({ description: 'Cart retrieved.', type: CartResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  getCart(@CurrentUser('sub') userId: string): Promise<CartResponseDto> {
    return this.cartService.getCart(userId);
  }

  @Post('items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add a product to the cart (or increase quantity if already present)' })
  @ApiOkResponse({ description: 'Item added.', type: CartResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiConflictResponse({ description: 'Requested quantity exceeds available stock.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  addItem(
    @CurrentUser('sub') userId: string,
    @Body() dto: AddCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cartService.addItem(userId, dto);
  }

  @Patch('items/:productId')
  @ApiOperation({ summary: 'Update the quantity of a cart item' })
  @ApiParam({ name: 'productId', description: 'Mongo ObjectId of the product.' })
  @ApiOkResponse({ description: 'Item updated.', type: CartResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found in cart.' })
  @ApiConflictResponse({ description: 'Requested quantity exceeds available stock.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  updateItem(
    @CurrentUser('sub') userId: string,
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cartService.updateItem(userId, productId, dto);
  }

  @Delete('items/:productId')
  @ApiOperation({ summary: 'Remove a product from the cart' })
  @ApiParam({ name: 'productId', description: 'Mongo ObjectId of the product.' })
  @ApiOkResponse({ description: 'Item removed.', type: CartResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found in cart.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  removeItem(
    @CurrentUser('sub') userId: string,
    @Param('productId', ParseObjectIdPipe) productId: string,
  ): Promise<CartResponseDto> {
    return this.cartService.removeItem(userId, productId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear all items from the cart' })
  @ApiNoContentResponse({ description: 'Cart cleared.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  async clear(@CurrentUser('sub') userId: string): Promise<void> {
    await this.cartService.clear(userId);
  }
}

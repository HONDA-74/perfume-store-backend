import {
  Body,
  Controller,
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../../../common/pipes/parse-object-id.pipe';
import { OrderStatus } from '../../../common/types/enums/order-status.enum';
import { Role } from '../../../common/types/enums/role.enum';
import { JwtPayload } from '../../../common/types/interfaces/jwt-payload.interface';
import { PaginatedResult } from '../../../common/types/interfaces/paginated-result.interface';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderResponseDto } from '../dto/order-response.dto';
import { QueryOrderDto } from '../dto/query-order.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { OrdersService } from '../services/orders.service';

/**
 * Order endpoints per API_BLUEPRINT.md §9 — the five documented routes, no
 * additions. Structurally follows CartController/WishlistController
 * (IMPLEMENTATION_PLAN.md M9 — same architecture as every prior module).
 *
 * Auth posture: `POST /orders` and `PATCH /orders/:id/cancel` are
 * Customer-only; `PATCH /orders/:id/status` is Admin-only; `GET /orders`
 * and `GET /orders/:id` are Auth (Any) — no `@Roles()` annotation, relying
 * on the globally-registered `JwtAuthGuard` alone (`RolesGuard` is a no-op
 * without explicit `@Roles()` metadata, per its own doc comment — same
 * pattern as `GET /auth/me`).
 */
@ApiTags('Orders')
@ApiBearerAuth('access-token')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Convert the current cart into an order (Customer only)' })
  @ApiCreatedResponse({ description: 'Order created.', type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'A product in the cart no longer exists.' })
  @ApiConflictResponse({ description: 'Insufficient stock for one or more items.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List orders (own orders for Customers, all orders for Admin)' })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'userId', required: false, description: 'Admin only.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Paginated order list.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryOrderDto,
  ): Promise<PaginatedResult<OrderResponseDto>> {
    return this.ordersService.findAll(user.sub, user.role, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single order by ID' })
  @ApiParam({ name: 'id', description: 'Mongo ObjectId of the order.' })
  @ApiOkResponse({ description: 'Order found.', type: OrderResponseDto })
  @ApiForbiddenResponse({ description: 'Caller does not own this order.' })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.findOne(user.sub, user.role, id);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update order fulfillment status (Admin only)' })
  @ApiParam({ name: 'id', description: 'Mongo ObjectId of the order.' })
  @ApiOkResponse({ description: 'Status updated.', type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  @ApiConflictResponse({ description: 'Illegal status transition.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Caller does not have the Admin role.' })
  updateStatus(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.updateStatus(id, dto);
  }

  @Patch(':id/cancel')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Cancel a pending or confirmed order (Customer only, own orders)' })
  @ApiParam({ name: 'id', description: 'Mongo ObjectId of the order.' })
  @ApiOkResponse({ description: 'Order cancelled.', type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  @ApiForbiddenResponse({ description: 'Caller does not own this order.' })
  @ApiConflictResponse({ description: 'Order can no longer be cancelled.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  cancel(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.cancel(userId, id);
  }
}

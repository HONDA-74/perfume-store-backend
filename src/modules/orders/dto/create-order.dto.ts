import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

/**
 * Transport validation only — no business logic (AI_RULES.md §11).
 * Per API_BLUEPRINT.md §9: "addressId (required, must reference one of the
 * customer's own saved addresses)". Ownership is verified in the service
 * layer (structural validation stops at "is this a valid ObjectId").
 * Cart-non-empty is also a service-layer concern — DTO has no cart field
 * because the cart is loaded server-side from the caller's identity, never
 * trusted from the request body.
 */
export class CreateOrderDto {
  @ApiProperty({
    example: '66f1a2b3c4d5e6f7a8b9c0a1',
    description: "Must reference one of the caller's own saved addresses.",
  })
  @IsMongoId()
  addressId!: string;
}

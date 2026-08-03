import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

/**
 * All fields optional (AI_RULES.md §11 — "Update DTOs use PartialType()").
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {}

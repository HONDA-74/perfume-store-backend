import { PartialType } from '@nestjs/swagger';
import { CreateBrandDto } from './create-brand.dto';

/**
 * All fields optional (AI_RULES.md §11 — "Update DTOs use PartialType()").
 */
export class UpdateBrandDto extends PartialType(CreateBrandDto) {}

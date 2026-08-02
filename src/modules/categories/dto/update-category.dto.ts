import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

/**
 * All fields optional (AI_RULES.md §11 — "Update DTOs use PartialType()").
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

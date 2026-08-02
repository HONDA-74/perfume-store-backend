import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Transport validation only — no business logic (AI_RULES.md §11).
 * Password rule (min 8 chars, at least one letter and one number) per
 * API_BLUEPRINT.md §2 "Validation Rules".
 */
export class RegisterDto {
  @ApiProperty({ example: 'Jane Doe', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'Str0ngPass1',
    minLength: 8,
    description: 'Min 8 chars, at least one letter and one number.',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'password must contain at least one letter and one number',
  })
  password!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../common/types/enums/role.enum';

export class AuthUserResponseDto {
  @ApiProperty({ example: '66f1a2b3c4d5e6f7a8b9c0d1' })
  id!: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  email!: string;

  @ApiProperty({ example: 'Jane Doe' })
  fullName!: string;

  @ApiProperty({ enum: Role, example: Role.CUSTOMER })
  role!: Role;
}

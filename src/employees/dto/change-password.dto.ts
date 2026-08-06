import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'NewStrongPassw0rd!' })
  @IsString()
  @MinLength(8)
  password: string;
}

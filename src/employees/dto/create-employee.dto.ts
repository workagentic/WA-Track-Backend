import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'jane@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'jane.doe' })
  @IsString()
  @Matches(/^[a-z0-9_.-]{3,32}$/, {
    message: 'username must be 3-32 lowercase letters, numbers, "_", "." or "-"',
  })
  username: string;

  @ApiProperty({
    example: 'StrongPassw0rd!',
    description: 'Plain password — hashed server-side before storage',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty()
  @IsInt()
  departmentId: number;

  @ApiProperty()
  @IsInt()
  roleId: number;

  @ApiPropertyOptional({ description: "Employee id of this employee's manager" })
  @IsOptional()
  @IsInt()
  managerId?: number;

  @ApiPropertyOptional({ enum: ['active', 'locked'], description: 'A "locked" employee cannot log in or use any existing session/token.' })
  @IsOptional()
  @IsIn(['active', 'locked'])
  status?: string;
}

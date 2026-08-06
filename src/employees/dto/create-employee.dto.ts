import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'jane@company.com' })
  @IsEmail()
  email: string;

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

  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}

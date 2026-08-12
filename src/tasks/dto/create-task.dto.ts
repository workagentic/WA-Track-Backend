import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 'Migrate billing service to v2' })
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsInt()
  departmentId: number;

  @ApiProperty()
  @IsInt()
  assignedToId: number;

  @ApiProperty()
  @IsInt()
  clientId: number;
}

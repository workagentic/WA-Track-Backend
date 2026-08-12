import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ example: 'ABC Company' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Retail client, EU region' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsInt()
  departmentId: number;
}

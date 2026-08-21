import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpdateTimeEntryDto {
  @ApiPropertyOptional({ description: 'New duration in seconds' })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  taskId?: number;

  @ApiPropertyOptional({ example: '2026-08-19' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ description: 'Required - why this entry is being corrected' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

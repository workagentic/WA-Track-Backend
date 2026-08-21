import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateManualTimeEntryDto {
  @ApiProperty()
  @IsInt()
  employeeId!: number;

  @ApiProperty()
  @IsInt()
  taskId!: number;

  @ApiProperty({ example: '2026-08-19', description: 'The calendar day this time was worked' })
  @IsDateString()
  date!: string;

  @ApiProperty({ description: 'Duration in seconds (e.g. 5 hours = 18000)' })
  @IsInt()
  @Min(1)
  durationSeconds!: number;

  @ApiPropertyOptional({ description: 'Why this entry is being added manually' })
  @IsOptional()
  @IsString()
  reason?: string;
}

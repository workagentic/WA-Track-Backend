import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class TimeEntryItemDto {
  @ApiProperty({ description: 'Client-generated id, used to de-duplicate on upsert' })
  @IsString()
  localId!: string;

  // The desktop app's local SQLite storage keeps taskId as TEXT, so this arrives over the
  // wire as a numeric string (e.g. "42"). @Type(() => Number) must run before @IsInt()
  // so validation coerces it instead of rejecting the sync payload.
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  taskId!: number;

  // Same numeric-string-from-SQLite issue as taskId above.
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  employeeId!: number;

  @ApiProperty()
  @IsDateString()
  startTime!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @ApiPropertyOptional({ enum: ['pending', 'synced', 'recovered'] })
  @IsOptional()
  @IsIn(['pending', 'synced', 'recovered'])
  syncStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  lastHeartbeat?: string;
}

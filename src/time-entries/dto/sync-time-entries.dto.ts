import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, ValidateNested } from 'class-validator';
import { TimeEntryItemDto } from './time-entry-item.dto';

export class SyncTimeEntriesDto {
  @ApiProperty({ type: [TimeEntryItemDto] })
  @ValidateNested({ each: true })
  @Type(() => TimeEntryItemDto)
  @ArrayMinSize(1)
  entries!: TimeEntryItemDto[];
}

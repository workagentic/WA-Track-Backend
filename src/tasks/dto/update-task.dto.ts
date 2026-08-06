import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiPropertyOptional({ enum: ['open', 'in_progress', 'done', 'archived'] })
  @IsOptional()
  @IsIn(['open', 'in_progress', 'done', 'archived'])
  status?: string;
}

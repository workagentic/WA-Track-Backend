import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateTaskDto } from './create-task.dto';

// clientId reassignment goes through PATCH /tasks/:id/assign-client for a clear audit point
export class UpdateTaskDto extends PartialType(OmitType(CreateTaskDto, ['clientId'] as const)) {}

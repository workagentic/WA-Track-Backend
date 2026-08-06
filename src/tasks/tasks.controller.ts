import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { TasksService, TaskWithDuration } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { Task } from './task.entity';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Get()
  findAll(
    @Query() query: QueryTasksDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaskWithDuration[]> {
    return this.tasksService.findAll(query, user);
  }

  @Post()
  @Roles('HR', 'MANAGER', 'ADMIN')
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthenticatedUser): Promise<Task> {
    return this.tasksService.create(dto, user);
  }

  @Patch(':id')
  @Roles('HR', 'MANAGER', 'ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Task> {
    return this.tasksService.update(id, dto, user);
  }
}

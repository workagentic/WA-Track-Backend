import {
  Body,
  Controller,
  Delete,
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
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import type { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { TasksService, TaskWithDuration } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { AssignClientDto } from './dto/assign-client.dto';
import { Task } from './task.entity';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Get()
  @ResponseMessage('Tasks fetched successfully')
  findAll(
    @Query() query: QueryTasksDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<TaskWithDuration>> {
    return this.tasksService.findAll(query, user);
  }

  @Post()
  @Roles('HR', 'MANAGER', 'ADMIN')
  @ResponseMessage('Task created successfully')
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthenticatedUser): Promise<Task> {
    return this.tasksService.create(dto, user);
  }

  @Patch(':id')
  @Roles('HR', 'MANAGER', 'ADMIN')
  @ResponseMessage('Task updated successfully')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Task> {
    return this.tasksService.update(id, dto, user);
  }

  @Patch(':id/assign-client')
  @Roles('HR', 'MANAGER', 'ADMIN')
  @ResponseMessage('Client assigned to task successfully')
  assignClient(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignClientDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Task> {
    return this.tasksService.assignClient(id, dto, user);
  }

  @Delete(':id')
  @Roles('HR', 'MANAGER', 'ADMIN')
  @ResponseMessage('Task deleted successfully')
  public async softDelete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.tasksService.softDelete(id, user);
  }

  @Patch(':id/restore')
  @Roles('HR', 'MANAGER', 'ADMIN')
  @ResponseMessage('Task restored successfully')
  public restore(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser): Promise<Task> {
    return this.tasksService.restore(id, user);
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './task.entity';
import { TimeEntry } from '../time-entries/time-entry.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

export type TaskWithDuration = Task & { totalDurationSeconds: number };

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private tasksRepo: Repository<Task>,
    @InjectRepository(TimeEntry) private timeEntriesRepo: Repository<TimeEntry>,
  ) {}

  public async findAll(query: QueryTasksDto, user: AuthenticatedUser): Promise<TaskWithDuration[]> {
    const qb = this.tasksRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.department', 'department')
      .leftJoinAndSelect('task.assignedTo', 'assignedTo')
      .leftJoinAndSelect('task.createdBy', 'createdBy');

    if (user.role === 'MANAGER') {
      qb.andWhere('department.id = :departmentId', { departmentId: user.departmentId });
    } else if (query.departmentId) {
      qb.andWhere('department.id = :departmentId', { departmentId: query.departmentId });
    }

    if (user.role === 'EMPLOYEE') {
      qb.andWhere('assignedTo.id = :employeeId', { employeeId: user.sub });
    }

    const tasks = await qb.getMany();
    const totals = await this.durationTotalsByTaskId(tasks.map((t) => t.id));
    return tasks.map((task) => ({ ...task, totalDurationSeconds: totals.get(task.id) ?? 0 }));
  }

  private async durationTotalsByTaskId(taskIds: number[]): Promise<Map<number, number>> {
    if (taskIds.length === 0) return new Map();

    const rows = await this.timeEntriesRepo
      .createQueryBuilder('entry')
      .leftJoin('entry.task', 'task')
      .select('task.id', 'taskId')
      .addSelect('COALESCE(SUM(entry.durationSeconds), 0)', 'totalDurationSeconds')
      .where('task.id IN (:...taskIds)', { taskIds })
      .groupBy('task.id')
      .getRawMany();

    return new Map(rows.map((r) => [Number(r.taskId), Number(r.totalDurationSeconds)]));
  }

  public async findById(id: number): Promise<Task> {
    const task = await this.tasksRepo.findOne({
      where: { id },
      relations: { department: true, assignedTo: true, createdBy: true },
    });
    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    return task;
  }

  public create(dto: CreateTaskDto, user: AuthenticatedUser): Promise<Task> {
    if (user.role === 'MANAGER' && dto.departmentId !== user.departmentId) {
      throw new ForbiddenException('Managers may only create tasks within their own department');
    }

    const task = this.tasksRepo.create({
      title: dto.title,
      description: dto.description,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      department: { id: dto.departmentId } as any,
      assignedTo: { id: dto.assignedToId } as any,
      createdBy: { id: user.sub } as any,
    });

    return this.tasksRepo.save(task);
  }

  public async update(id: number, dto: UpdateTaskDto, user: AuthenticatedUser): Promise<Task> {
    const task = await this.findById(id);

    if (user.role === 'MANAGER' && task.department?.id !== user.departmentId) {
      throw new ForbiddenException('Managers may only update tasks within their own department');
    }

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.dueDate !== undefined) task.dueDate = new Date(dto.dueDate);
    if (dto.departmentId !== undefined) task.department = { id: dto.departmentId } as any;
    if (dto.assignedToId !== undefined) task.assignedTo = { id: dto.assignedToId } as any;

    return this.tasksRepo.save(task);
  }
}

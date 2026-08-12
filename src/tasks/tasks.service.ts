import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './task.entity';
import { Client } from '../clients/client.entity';
import { TimeEntry } from '../time-entries/time-entry.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { AssignClientDto } from './dto/assign-client.dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { buildPaginatedResult } from '../common/utils/paginate.util';

export type TaskWithDuration = Task & { totalDurationSeconds: number };

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private tasksRepo: Repository<Task>,
    @InjectRepository(TimeEntry) private timeEntriesRepo: Repository<TimeEntry>,
    @InjectRepository(Client) private clientsRepo: Repository<Client>,
  ) {}

  public async findAll(
    query: QueryTasksDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<TaskWithDuration>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.tasksRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.department', 'department')
      .leftJoinAndSelect('task.assignedTo', 'assignedTo')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .leftJoinAndSelect('task.client', 'client');

    if (user.role === 'MANAGER') {
      qb.andWhere('department.id = :departmentId', { departmentId: user.departmentId });
    } else if (query.departmentId) {
      qb.andWhere('department.id = :departmentId', { departmentId: query.departmentId });
    }

    if (user.role === 'EMPLOYEE') {
      qb.andWhere('assignedTo.id = :employeeId', { employeeId: user.sub });
    }

    qb.skip((page - 1) * limit).take(limit);

    const [tasks, total] = await qb.getManyAndCount();
    const totals = await this.durationTotalsByTaskId(tasks.map((t) => t.id));
    const data = tasks.map((task) => ({ ...task, totalDurationSeconds: totals.get(task.id) ?? 0 }));

    return buildPaginatedResult(data, total, page, limit);
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
      relations: { department: true, assignedTo: true, createdBy: true, client: true },
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
      department: { id: dto.departmentId } as any,
      assignedTo: { id: dto.assignedToId } as any,
      createdBy: { id: user.sub } as any,
      client: { id: dto.clientId } as any,
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
    if (dto.departmentId !== undefined) task.department = { id: dto.departmentId } as any;
    if (dto.assignedToId !== undefined) task.assignedTo = { id: dto.assignedToId } as any;

    return this.tasksRepo.save(task);
  }

  public async assignClient(id: number, dto: AssignClientDto, user: AuthenticatedUser): Promise<Task> {
    const task = await this.findById(id);

    if (user.role === 'MANAGER' && task.department?.id !== user.departmentId) {
      throw new ForbiddenException('Managers may only reassign tasks within their own department');
    }

    const client = await this.clientsRepo.findOne({
      where: { id: dto.clientId },
      relations: { department: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${dto.clientId} not found`);
    }
    if (user.role === 'MANAGER' && client.department?.id !== user.departmentId) {
      throw new ForbiddenException('Managers may only assign clients within their own department');
    }

    task.client = client;
    return this.tasksRepo.save(task);
  }

  public async softDelete(id: number, actingUserId: number): Promise<void> {
    await this.findById(id);
    await this.tasksRepo.update(id, { deletedAt: new Date(), deletedBy: { id: actingUserId } as any });
  }

  public async restore(id: number): Promise<Task> {
    const task = await this.tasksRepo.findOne({ where: { id }, withDeleted: true });
    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    await this.tasksRepo.update(id, { deletedAt: null, deletedBy: null });
    return this.findById(id);
  }
}

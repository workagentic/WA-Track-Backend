import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeEntry } from './time-entry.entity';
import { SyncTimeEntriesDto } from './dto/sync-time-entries.dto';
import { QueryTimeEntriesDto } from './dto/query-time-entries.dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { buildPaginatedResult } from '../common/utils/paginate.util';

@Injectable()
export class TimeEntriesService {
  constructor(@InjectRepository(TimeEntry) private timeEntriesRepo: Repository<TimeEntry>) {}

  /** Upserts by localId so retried/batched syncs from the desktop app never create duplicates. */
  public async sync(dto: SyncTimeEntriesDto, user: AuthenticatedUser): Promise<TimeEntry[]> {
    const isSelfOnly = user.role === 'EMPLOYEE' || user.role === 'MANAGER';

    for (const item of dto.entries) {
      if (isSelfOnly && item.employeeId !== user.sub) {
        throw new ForbiddenException('Cannot sync time entries on behalf of another employee');
      }
    }

    const saved: TimeEntry[] = [];

    for (const item of dto.entries) {
      let entry = await this.timeEntriesRepo.findOne({ where: { localId: item.localId } });

      if (!entry) {
        entry = this.timeEntriesRepo.create({ localId: item.localId });
      }

      entry.employee = { id: item.employeeId } as any;
      entry.task = { id: item.taskId } as any;
      entry.startTime = new Date(item.startTime);
      entry.endTime = item.endTime ? new Date(item.endTime) : entry.endTime ?? undefined;
      entry.durationSeconds = item.durationSeconds ?? entry.durationSeconds ?? 0;
      entry.syncStatus = 'synced';
      entry.lastHeartbeat = item.lastHeartbeat ? new Date(item.lastHeartbeat) : entry.lastHeartbeat ?? undefined;

      saved.push(await this.timeEntriesRepo.save(entry));
    }

    return saved;
  }

  public async findAll(query: QueryTimeEntriesDto, user: AuthenticatedUser): Promise<PaginatedResult<TimeEntry>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.timeEntriesRepo
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.employee', 'employee')
      .leftJoinAndSelect('employee.department', 'department')
      .leftJoinAndSelect('entry.task', 'task');

    if (user.role === 'EMPLOYEE') {
      qb.andWhere('employee.id = :employeeId', { employeeId: user.sub });
    } else if (user.role === 'MANAGER') {
      qb.andWhere('department.id = :departmentId', { departmentId: user.departmentId });
      if (query.employeeId) {
        qb.andWhere('employee.id = :queryEmployeeId', { queryEmployeeId: query.employeeId });
      }
    } else if (query.employeeId) {
      qb.andWhere('employee.id = :queryEmployeeId', { queryEmployeeId: query.employeeId });
    }

    if (query.taskId) {
      qb.andWhere('task.id = :taskId', { taskId: query.taskId });
    }
    if (query.from) {
      qb.andWhere('entry.startTime >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('entry.startTime <= :to', { to: query.to });
    }

    qb.orderBy('entry.startTime', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, page, limit);
  }
}

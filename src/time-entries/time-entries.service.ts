import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeEntry } from './time-entry.entity';
import { SyncTimeEntriesDto } from './dto/sync-time-entries.dto';
import { QueryTimeEntriesDto } from './dto/query-time-entries.dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { buildPaginatedResult } from '../common/utils/paginate.util';
import { toInclusiveEndOfDay } from '../common/utils/date-range.util';

@Injectable()
export class TimeEntriesService {
  constructor(@InjectRepository(TimeEntry) private timeEntriesRepo: Repository<TimeEntry>) {}

  /**
   * Upserts by localId so retried/batched syncs from the desktop app never
   * create duplicates. Each entry is validated/saved independently rather
   * than all-or-nothing: the desktop app sends every pending entry in one
   * batch, and on a shared machine that batch can contain a leftover entry
   * from a previous employee's session — rejecting the whole request over
   * one foreign entry would permanently block every other (legitimately
   * owned) entry in the same batch from ever syncing.
   */
  public async sync(dto: SyncTimeEntriesDto, user: AuthenticatedUser): Promise<TimeEntry[]> {
    const isSelfOnly = user.role === 'EMPLOYEE' || user.role === 'MANAGER';
    const saved: TimeEntry[] = [];

    for (const item of dto.entries) {
      if (isSelfOnly && item.employeeId !== user.sub) {
        continue;
      }

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
      qb.andWhere('entry.startTime <= :to', { to: toInclusiveEndOfDay(query.to) });
    }

    qb.orderBy('entry.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, page, limit);
  }
}

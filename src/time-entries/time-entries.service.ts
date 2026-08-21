import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { TimeEntry } from './time-entry.entity';
import { TimeEntryAudit } from './time-entry-audit.entity';
import { Employee } from '../employees/employee.entity';
import { Task } from '../tasks/task.entity';
import { SyncTimeEntriesDto } from './dto/sync-time-entries.dto';
import { QueryTimeEntriesDto } from './dto/query-time-entries.dto';
import { CreateManualTimeEntryDto } from './dto/create-manual-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { buildPaginatedResult } from '../common/utils/paginate.util';
import { toInclusiveEndOfDay } from '../common/utils/date-range.util';

@Injectable()
export class TimeEntriesService {
  constructor(
    @InjectRepository(TimeEntry) private timeEntriesRepo: Repository<TimeEntry>,
    @InjectRepository(TimeEntryAudit) private timeEntryAuditsRepo: Repository<TimeEntryAudit>,
    @InjectRepository(Employee) private employeesRepo: Repository<Employee>,
    @InjectRepository(Task) private tasksRepo: Repository<Task>,
  ) {}

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

      // HR's correction is authoritative once made — a desktop resync of the
      // same localId (lost response, restored local DB, ...) must not be
      // allowed to silently revert it. See TIME_ENTRY_AUDIT_MECHANICS.md.
      if (entry?.manuallyEdited) {
        continue;
      }

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
      .leftJoinAndSelect('entry.task', 'task')
      .leftJoinAndSelect('entry.editedBy', 'editedBy');

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

  private async assertEmployeeExists(id: number): Promise<void> {
    const found = await this.employeesRepo.findOneBy({ id });
    if (!found) throw new NotFoundException(`Employee ${id} not found`);
  }

  private async assertTaskExists(id: number): Promise<void> {
    const found = await this.tasksRepo.findOneBy({ id });
    if (!found) throw new NotFoundException(`Task ${id} not found`);
  }

  private async findByIdOrThrow(id: number): Promise<TimeEntry> {
    const entry = await this.timeEntriesRepo.findOne({
      where: { id },
      relations: { employee: true, task: true },
    });
    if (!entry) throw new NotFoundException(`Time entry ${id} not found`);
    return entry;
  }

  /** HR/ADMIN-only: create a time entry the employee never tracked themselves. */
  public async createManual(dto: CreateManualTimeEntryDto, user: AuthenticatedUser): Promise<TimeEntry> {
    await this.assertEmployeeExists(dto.employeeId);
    await this.assertTaskExists(dto.taskId);

    const startTime = new Date(`${dto.date}T00:00:00.000Z`);
    const endTime = new Date(startTime.getTime() + dto.durationSeconds * 1000);

    const entry = this.timeEntriesRepo.create({
      // Desktop-generated localIds are real UUIDs; this prefix makes an
      // HR-originated row instantly recognizable in the data and can never
      // collide with one the desktop app itself generates.
      localId: `manual-${randomUUID()}`,
      employee: { id: dto.employeeId } as any,
      task: { id: dto.taskId } as any,
      startTime,
      endTime,
      durationSeconds: dto.durationSeconds,
      syncStatus: 'synced',
      manuallyEdited: true,
      editedBy: { id: user.sub } as any,
      editedAt: new Date(),
    });
    const saved = await this.timeEntriesRepo.save(entry);

    await this.timeEntryAuditsRepo.save(
      this.timeEntryAuditsRepo.create({
        timeEntry: { id: saved.id } as any,
        editedBy: { id: user.sub } as any,
        previousDurationSeconds: 0,
        newDurationSeconds: dto.durationSeconds,
        reason: dto.reason ?? null,
      }),
    );

    return this.findByIdOrThrow(saved.id);
  }

  /** HR/ADMIN-only: correct an entry that already exists (desktop-tracked or manual). */
  public async update(id: number, dto: UpdateTimeEntryDto, user: AuthenticatedUser): Promise<TimeEntry> {
    const entry = await this.findByIdOrThrow(id);
    const previousDurationSeconds = entry.durationSeconds;

    if (dto.taskId !== undefined) {
      await this.assertTaskExists(dto.taskId);
      entry.task = { id: dto.taskId } as any;
    }

    const newDurationSeconds = dto.durationSeconds ?? entry.durationSeconds;
    if (dto.date !== undefined || dto.durationSeconds !== undefined) {
      const dateBasis = dto.date ?? entry.startTime.toISOString().slice(0, 10);
      const startTime = new Date(`${dateBasis}T00:00:00.000Z`);
      entry.startTime = startTime;
      entry.endTime = new Date(startTime.getTime() + newDurationSeconds * 1000);
    }
    entry.durationSeconds = newDurationSeconds;

    entry.manuallyEdited = true;
    entry.editedBy = { id: user.sub } as any;
    entry.editedAt = new Date();

    const saved = await this.timeEntriesRepo.save(entry);

    await this.timeEntryAuditsRepo.save(
      this.timeEntryAuditsRepo.create({
        timeEntry: { id: saved.id } as any,
        editedBy: { id: user.sub } as any,
        previousDurationSeconds,
        newDurationSeconds,
        reason: dto.reason,
      }),
    );

    return this.findByIdOrThrow(saved.id);
  }

  public async getAuditHistory(timeEntryId: number): Promise<TimeEntryAudit[]> {
    await this.findByIdOrThrow(timeEntryId);
    return this.timeEntryAuditsRepo.find({
      where: { timeEntry: { id: timeEntryId } },
      relations: { editedBy: true },
      order: { editedAt: 'DESC' },
    });
  }
}

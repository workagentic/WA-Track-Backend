import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { Department } from '../departments/department.entity';
import { Client } from '../clients/client.entity';
import { Task } from '../tasks/task.entity';
import { QueryAuditDto } from './dto/query-audit.dto';
import { AuditActor, AuditEntityType, AuditEntry } from './interfaces/audit-entry.interface';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { buildPaginatedResult } from '../common/utils/paginate.util';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(Employee) private employeesRepo: Repository<Employee>,
    @InjectRepository(Department) private departmentsRepo: Repository<Department>,
    @InjectRepository(Client) private clientsRepo: Repository<Client>,
    @InjectRepository(Task) private tasksRepo: Repository<Task>,
  ) {}

  private toActor(employee: Employee | null | undefined): AuditActor | null {
    if (!employee) return null;
    return { id: employee.id, fullName: employee.fullName, username: employee.username };
  }

  private applyCommonFilters(rows: AuditEntry[], query: QueryAuditDto): AuditEntry[] {
    return rows.filter((row) => {
      if (query.deletedById !== undefined && row.deletedBy?.id !== query.deletedById) return false;
      if (query.from && row.deletedAt < new Date(query.from)) return false;
      if (query.to && row.deletedAt > new Date(query.to)) return false;
      return true;
    });
  }

  private async loadEmployeeDeletions(query: QueryAuditDto): Promise<AuditEntry[]> {
    const rows = await this.employeesRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.deletedBy', 'deletedBy')
      .withDeleted()
      .andWhere('employee.deletedAt IS NOT NULL')
      .getMany();

    return this.applyCommonFilters(
      rows.map((employee) => ({
        entityType: 'employee' as const,
        id: employee.id,
        label: employee.fullName,
        createdAt: employee.createdAt,
        createdBy: null,
        deletedAt: employee.deletedAt as Date,
        deletedBy: this.toActor(employee.deletedBy),
      })),
      query,
    );
  }

  private async loadDepartmentDeletions(query: QueryAuditDto): Promise<AuditEntry[]> {
    const rows = await this.departmentsRepo
      .createQueryBuilder('department')
      .leftJoinAndSelect('department.deletedBy', 'deletedBy')
      .withDeleted()
      .andWhere('department.deletedAt IS NOT NULL')
      .getMany();

    return this.applyCommonFilters(
      rows.map((department) => ({
        entityType: 'department' as const,
        id: department.id,
        label: department.name,
        createdAt: null,
        createdBy: null,
        deletedAt: department.deletedAt as Date,
        deletedBy: this.toActor(department.deletedBy),
      })),
      query,
    );
  }

  private async loadClientDeletions(query: QueryAuditDto): Promise<AuditEntry[]> {
    const rows = await this.clientsRepo
      .createQueryBuilder('client')
      .leftJoinAndSelect('client.deletedBy', 'deletedBy')
      .leftJoinAndSelect('client.createdBy', 'createdBy')
      .withDeleted()
      .andWhere('client.deletedAt IS NOT NULL')
      .getMany();

    return this.applyCommonFilters(
      rows.map((client) => ({
        entityType: 'client' as const,
        id: client.id,
        label: client.name,
        createdAt: client.createdAt,
        createdBy: this.toActor(client.createdBy),
        deletedAt: client.deletedAt as Date,
        deletedBy: this.toActor(client.deletedBy),
      })),
      query,
    );
  }

  private async loadTaskDeletions(query: QueryAuditDto): Promise<AuditEntry[]> {
    const rows = await this.tasksRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.deletedBy', 'deletedBy')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .withDeleted()
      .andWhere('task.deletedAt IS NOT NULL')
      .getMany();

    return this.applyCommonFilters(
      rows.map((task) => ({
        entityType: 'task' as const,
        id: task.id,
        label: task.title,
        createdAt: null,
        createdBy: this.toActor(task.createdBy),
        deletedAt: task.deletedAt as Date,
        deletedBy: this.toActor(task.deletedBy),
      })),
      query,
    );
  }

  /** Merges + sorts every matching deletion, unpaginated — the shared basis for both public methods below. */
  private async loadAll(query: QueryAuditDto): Promise<AuditEntry[]> {
    const loaders: Array<{ type: AuditEntityType; load: () => Promise<AuditEntry[]> }> = [
      { type: 'employee', load: () => this.loadEmployeeDeletions(query) },
      { type: 'department', load: () => this.loadDepartmentDeletions(query) },
      { type: 'client', load: () => this.loadClientDeletions(query) },
      { type: 'task', load: () => this.loadTaskDeletions(query) },
    ];

    const selected = query.entityType ? loaders.filter((l) => l.type === query.entityType) : loaders;
    const results = await Promise.all(selected.map((l) => l.load()));

    return results.flat().sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
  }

  public async findDeletions(query: QueryAuditDto): Promise<PaginatedResult<AuditEntry>> {
    const all = await this.loadAll(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;

    return buildPaginatedResult(all.slice(start, start + limit), all.length, page, limit);
  }

  public async findOne(entityType: AuditEntityType, id: number): Promise<AuditEntry> {
    const all = await this.loadAll({ entityType } as QueryAuditDto);
    const entry = all.find((e) => e.id === id);
    if (!entry) {
      throw new NotFoundException(`No deleted ${entityType} found with id ${id}`);
    }
    return entry;
  }
}

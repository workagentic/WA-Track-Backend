import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Department } from './department.entity';
import { Client } from '../clients/client.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { buildPaginatedResult } from '../common/utils/paginate.util';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department) private departmentsRepo: Repository<Department>,
    @InjectRepository(Client) private clientsRepo: Repository<Client>,
  ) {}

  async findAll(page = 1, limit = 20): Promise<PaginatedResult<Department>> {
    const [data, total] = await this.departmentsRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });
    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: number): Promise<Department> {
    const department = await this.departmentsRepo.findOne({ where: { id } });
    if (!department) {
      throw new NotFoundException(`Department ${id} not found`);
    }
    return department;
    
  }

  async create(dto: CreateDepartmentDto): Promise<Department> {
    await this.assertNameAvailable(dto.name);

    const department = this.departmentsRepo.create(dto);

    try {
      return await this.departmentsRepo.save(department);
    } catch (error) {
      throw this.translateUniqueViolation(error);
    }
  }

  async update(id: number, dto: UpdateDepartmentDto): Promise<Department> {
    const department = await this.findById(id);

    if (dto.name !== undefined && dto.name !== department.name) {
      await this.assertNameAvailable(dto.name);
    }

    Object.assign(department, dto);

    try {
      return await this.departmentsRepo.save(department);
    } catch (error) {
      throw this.translateUniqueViolation(error);
    }
  }

  /**
   * Pre-check for a clean, specific message in the common case;
   * translateUniqueViolation() below is the safety net for the race between
   * this check and the actual INSERT/UPDATE hitting the partial unique index
   * (UQ_departments_name_active, scoped to deletedAt IS NULL so a
   * soft-deleted department's name can be reused).
   */
  private async assertNameAvailable(name: string): Promise<void> {
    const existing = await this.departmentsRepo.findOne({ where: { name } });
    if (existing) {
      throw new ConflictException(`A department named "${name}" already exists`);
    }
  }

  private translateUniqueViolation(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = (error as QueryFailedError & { driverError?: { code?: string; constraint?: string } })
        .driverError;

      if (driverError?.code === '23505' && driverError.constraint === 'UQ_departments_name_active') {
        throw new ConflictException('A department with this name already exists');
      }
    }

    throw error;
  }

  public async softDelete(id: number, actingUserId: number, force: boolean): Promise<void> {
    await this.findById(id);

    const activeClientCount = await this.clientsRepo.count({ where: { department: { id } } });
    if (activeClientCount > 0 && !force) {
      throw new ConflictException(
        `Department ${id} has ${activeClientCount} active client(s). Pass force=true to also archive them.`,
      );
    }
    if (activeClientCount > 0 && force) {
      await this.clientsRepo.update({ department: { id } } as any, {
        deletedAt: new Date(),
        deletedBy: { id: actingUserId } as any,
      });
    }

    await this.departmentsRepo.update(id, {
      deletedAt: new Date(),
      deletedBy: { id: actingUserId } as any,
    });
  }

  public async restore(id: number): Promise<Department> {
    const department = await this.departmentsRepo.findOne({ where: { id }, withDeleted: true });
    if (!department) {
      throw new NotFoundException(`Department ${id} not found`);
    }
    await this.departmentsRepo.update(id, { deletedAt: null, deletedBy: null });
    return this.findById(id);
  }
}

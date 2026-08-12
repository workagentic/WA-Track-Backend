import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Client } from './client.entity';
import { Task } from '../tasks/task.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { buildPaginatedResult } from '../common/utils/paginate.util';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client) private clientsRepo: Repository<Client>,
    @InjectRepository(Task) private tasksRepo: Repository<Task>,
  ) {}

  public async findAll(
    user: AuthenticatedUser,
    withDeleted = false,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<Client>> {
    const qb = this.clientsRepo
      .createQueryBuilder('client')
      .leftJoinAndSelect('client.department', 'department')
      .leftJoinAndSelect('client.createdBy', 'createdBy');

    if (withDeleted) {
      qb.withDeleted();
    }
    if (user.role === 'MANAGER') {
      qb.andWhere('department.id = :departmentId', { departmentId: user.departmentId });
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, page, limit);
  }

  public async findById(id: number): Promise<Client> {
    const client = await this.clientsRepo.findOne({
      where: { id },
      relations: { department: true, createdBy: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }
    return client;
  }

  public async create(dto: CreateClientDto, user: AuthenticatedUser): Promise<Client> {
    if (user.role === 'MANAGER' && dto.departmentId !== user.departmentId) {
      throw new ForbiddenException('Managers may only create clients within their own department');
    }

    await this.assertNameAvailableInDepartment(dto.name, dto.departmentId);

    const client = this.clientsRepo.create({
      name: dto.name,
      description: dto.description,
      department: { id: dto.departmentId } as any,
      createdBy: { id: user.sub } as any,
    });

    try {
      return await this.clientsRepo.save(client);
    } catch (error) {
      throw this.translateUniqueViolation(error);
    }
  }

  public async update(id: number, dto: UpdateClientDto, user: AuthenticatedUser): Promise<Client> {
    const client = await this.findById(id);

    if (user.role === 'MANAGER' && client.department?.id !== user.departmentId) {
      throw new ForbiddenException('Managers may only update clients within their own department');
    }

    if (dto.name !== undefined && dto.name !== client.name) {
      await this.assertNameAvailableInDepartment(dto.name, client.department.id);
    }

    if (dto.name !== undefined) client.name = dto.name;
    if (dto.description !== undefined) client.description = dto.description;

    try {
      return await this.clientsRepo.save(client);
    } catch (error) {
      throw this.translateUniqueViolation(error);
    }
  }

  /**
   * Pre-check for a clean, specific message in the common case;
   * translateUniqueViolation() below is the safety net for the race between
   * this check and the actual INSERT/UPDATE hitting the partial unique index
   * (UQ_clients_name_department_active, scoped to deletedAt IS NULL so a
   * soft-deleted client's name can be reused in the same department).
   */
  private async assertNameAvailableInDepartment(name: string, departmentId: number): Promise<void> {
    const existing = await this.clientsRepo.findOne({
      where: { name, department: { id: departmentId } },
    });
    if (existing) {
      throw new ConflictException(`A client named "${name}" already exists in this department`);
    }
  }

  private translateUniqueViolation(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = (error as QueryFailedError & { driverError?: { code?: string; constraint?: string } })
        .driverError;

      if (driverError?.code === '23505' && driverError.constraint === 'UQ_clients_name_department_active') {
        throw new ConflictException('A client with this name already exists in this department');
      }
    }

    throw error;
  }

  public async softDelete(id: number, actingUserId: number, force: boolean): Promise<void> {
    await this.findById(id);

    const activeTaskCount = await this.tasksRepo.count({ where: { client: { id } } });
    if (activeTaskCount > 0 && !force) {
      throw new ConflictException(
        `Client ${id} has ${activeTaskCount} active task(s). Pass force=true to also archive them.`,
      );
    }
    if (activeTaskCount > 0 && force) {
      await this.tasksRepo.update({ client: { id } } as any, {
        deletedAt: new Date(),
        deletedBy: { id: actingUserId } as any,
      });
    }

    await this.clientsRepo.update(id, { deletedAt: new Date(), deletedBy: { id: actingUserId } as any });
  }

  public async restore(id: number): Promise<Client> {
    const client = await this.clientsRepo.findOne({ where: { id }, withDeleted: true });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }
    await this.clientsRepo.update(id, { deletedAt: null, deletedBy: null });
    return this.findById(id);
  }
}

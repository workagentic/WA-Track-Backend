import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { QueryFailedError, Repository } from 'typeorm';
import { Employee } from './employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { buildPaginatedResult } from '../common/utils/paginate.util';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee) private employeesRepo: Repository<Employee>,
    private config: ConfigService,
  ) {}

  /**
   * MANAGER only ever sees/acts on employees within their own department —
   * so its `total` is a correct subordinate headcount. EMPLOYEE is scoped to
   * only their own record: an employee must never learn the org-wide (or
   * even department-wide) employee count, and that has to be enforced here,
   * not just hidden in the UI — the DTO's `total` field is exactly the kind
   * of "count" this endpoint must not hand an EMPLOYEE. HR/ADMIN are
   * unrestricted (org-wide), matching every other org-wide-visibility check
   * in this codebase.
   */
  public async findAll(user: AuthenticatedUser, page = 1, limit = 20): Promise<PaginatedResult<Employee>> {
    const qb = this.employeesRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.department', 'department')
      .leftJoinAndSelect('employee.role', 'role')
      .leftJoinAndSelect('employee.manager', 'manager');

    if (user.role === 'MANAGER') {
      qb.where('department.id = :departmentId', { departmentId: user.departmentId });
    } else if (user.role === 'EMPLOYEE') {
      qb.where('employee.id = :employeeId', { employeeId: user.sub });
    }

    qb.orderBy('employee.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, page, limit);
  }

  public async findById(id: number): Promise<Employee> {
    const employee = await this.employeesRepo.findOne({
      where: { id },
      relations: { department: true, role: true, manager: true },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }
    return employee;
  }

  public async create(dto: CreateEmployeeDto): Promise<Employee> {
    await this.assertEmailAndUsernameAvailable(dto.email, dto.username);

    const saltRounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const employee = this.employeesRepo.create({
      fullName: dto.fullName,
      email: dto.email,
      username: dto.username,
      passwordHash,
      status: dto.status ?? 'active',
      department: { id: dto.departmentId } as any,
      role: { id: dto.roleId } as any,
      manager: dto.managerId ? ({ id: dto.managerId } as any) : undefined,
    });

    try {
      return await this.employeesRepo.save(employee);
    } catch (error) {
      throw this.translateUniqueViolation(error);
    }
  }

  public async update(id: number, dto: UpdateEmployeeDto): Promise<Employee> {
    const employee = await this.findById(id);

    if (dto.email !== undefined && dto.email !== employee.email) {
      await this.assertEmailAndUsernameAvailable(dto.email);
    }

    if (dto.fullName !== undefined) employee.fullName = dto.fullName;
    if (dto.email !== undefined) employee.email = dto.email;
    if (dto.status !== undefined) employee.status = dto.status;
    if (dto.departmentId !== undefined) employee.department = { id: dto.departmentId } as any;
    if (dto.roleId !== undefined) employee.role = { id: dto.roleId } as any;
    if (dto.managerId !== undefined) employee.manager = { id: dto.managerId } as any;

    try {
      return await this.employeesRepo.save(employee);
    } catch (error) {
      throw this.translateUniqueViolation(error);
    }
  }

  /**
   * Pre-checks give a clean, specific message in the common case; the
   * `translateUniqueViolation` catch in create()/update() is the safety net
   * for the race between this check and the actual INSERT/UPDATE. Both
   * lookups naturally exclude soft-deleted employees (no @DeleteDateColumn
   * bypass here), matching the partial-unique-index design that lets a
   * soft-deleted employee's email/username be reused.
   */
  private async assertEmailAndUsernameAvailable(email: string, username?: string): Promise<void> {
    const [existingEmail, existingUsername] = await Promise.all([
      this.employeesRepo.findOne({ where: { email } }),
      username ? this.employeesRepo.findOne({ where: { username } }) : Promise.resolve(null),
    ]);

    if (existingEmail && existingUsername) {
      throw new ConflictException('Email and username are already registered');
    }
    if (existingEmail) {
      throw new ConflictException('Email is already registered');
    }
    if (existingUsername) {
      throw new ConflictException('Username is already taken');
    }
  }

  private translateUniqueViolation(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = (error as QueryFailedError & { driverError?: { code?: string; constraint?: string } })
        .driverError;

      if (driverError?.code === '23505') {
        if (driverError.constraint === 'UQ_employees_email_active') {
          throw new ConflictException('Email is already registered');
        }
        if (driverError.constraint === 'UQ_employees_username_active') {
          throw new ConflictException('Username is already taken');
        }
      }
    }

    throw error;
  }

  public async changePassword(id: number, plainPassword: string): Promise<void> {
    const employee = await this.findById(id);
    const saltRounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
    employee.passwordHash = await bcrypt.hash(plainPassword, saltRounds);
    await this.employeesRepo.save(employee);
  }

  public async softDelete(id: number, actingUserId: number): Promise<void> {
    await this.findById(id);
    await this.employeesRepo.update(id, {
      deletedAt: new Date(),
      deletedBy: { id: actingUserId } as any,
    });
  }

  public async restore(id: number): Promise<Employee> {
    const employee = await this.employeesRepo.findOne({ where: { id }, withDeleted: true });
    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }
    await this.employeesRepo.update(id, { deletedAt: null, deletedBy: null });
    return this.findById(id);
  }
}

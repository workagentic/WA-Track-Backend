import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Employee } from './employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee) private employeesRepo: Repository<Employee>,
    private config: ConfigService,
  ) {}

  /** Managers only ever see/act on employees within their own department. */
  public async findAll(user: AuthenticatedUser): Promise<Employee[]> {
    const qb = this.employeesRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.department', 'department')
      .leftJoinAndSelect('employee.role', 'role')
      .leftJoinAndSelect('employee.manager', 'manager');

    if (user.role === 'MANAGER') {
      qb.where('department.id = :departmentId', { departmentId: user.departmentId });
    }

    return qb.getMany();
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
    const saltRounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const employee = this.employeesRepo.create({
      fullName: dto.fullName,
      email: dto.email,
      passwordHash,
      status: dto.status ?? 'active',
      department: { id: dto.departmentId } as any,
      role: { id: dto.roleId } as any,
      manager: dto.managerId ? ({ id: dto.managerId } as any) : undefined,
    });

    return this.employeesRepo.save(employee);
  }

  public async update(id: number, dto: UpdateEmployeeDto, user: AuthenticatedUser): Promise<Employee> {
    const employee = await this.findById(id);

    if (user.role === 'MANAGER' && employee.department?.id !== user.departmentId) {
      throw new ForbiddenException('Managers may only update employees within their own department');
    }

    if (dto.fullName !== undefined) employee.fullName = dto.fullName;
    if (dto.email !== undefined) employee.email = dto.email;
    if (dto.status !== undefined) employee.status = dto.status;
    if (dto.departmentId !== undefined) employee.department = { id: dto.departmentId } as any;
    if (dto.roleId !== undefined) employee.role = { id: dto.roleId } as any;
    if (dto.managerId !== undefined) employee.manager = { id: dto.managerId } as any;

    return this.employeesRepo.save(employee);
  }

  public async changePassword(id: number, plainPassword: string): Promise<void> {
    const employee = await this.findById(id);
    const saltRounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
    employee.passwordHash = await bcrypt.hash(plainPassword, saltRounds);
    await this.employeesRepo.save(employee);
  }
}

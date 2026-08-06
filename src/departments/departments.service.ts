import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(@InjectRepository(Department) private departmentsRepo: Repository<Department>) {}

  findAll(): Promise<Department[]> {
    return this.departmentsRepo.find();
  }

  async findById(id: number): Promise<Department> {
    const department = await this.departmentsRepo.findOne({ where: { id } });
    if (!department) {
      throw new NotFoundException(`Department ${id} not found`);
    }
    return department;
    
  }

  create(dto: CreateDepartmentDto): Promise<Department> {
    const department = this.departmentsRepo.create(dto);
    return this.departmentsRepo.save(department);
  }

  async update(id: number, dto: UpdateDepartmentDto): Promise<Department> {
    const department = await this.findById(id);
    Object.assign(department, dto);
    return this.departmentsRepo.save(department);
  }
}

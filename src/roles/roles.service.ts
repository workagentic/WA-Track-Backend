import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './role.entity';

@Injectable()
export class RolesService {
  constructor(@InjectRepository(Role) private rolesRepo: Repository<Role>) {}

  public findAll(): Promise<Role[]> {
    return this.rolesRepo.find();
  }

  public findById(id: number): Promise<Role | null> {
    return this.rolesRepo.findOne({ where: { id } });
  }

  public findByName(name: string): Promise<Role | null> {
    return this.rolesRepo.findOne({ where: { name } });
  }
}

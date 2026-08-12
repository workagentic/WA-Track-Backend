import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './role.entity';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { buildPaginatedResult } from '../common/utils/paginate.util';

@Injectable()
export class RolesService {
  constructor(@InjectRepository(Role) private rolesRepo: Repository<Role>) {}

  public async findAll(page = 1, limit = 20): Promise<PaginatedResult<Role>> {
    const [data, total] = await this.rolesRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });
    return buildPaginatedResult(data, total, page, limit);
  }

  public findById(id: number): Promise<Role | null> {
    return this.rolesRepo.findOne({ where: { id } });
  }

  public findByName(name: string): Promise<Role | null> {
    return this.rolesRepo.findOne({ where: { name } });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceSession } from './device-session.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { buildPaginatedResult } from '../common/utils/paginate.util';

@Injectable()
export class DeviceSessionsService {
  constructor(@InjectRepository(DeviceSession) private deviceSessionsRepo: Repository<DeviceSession>) {}

  // HR/ADMIN manage devices org-wide (hence the employee relation, so they
  // can tell whose device they're looking at); EMPLOYEE/MANAGER only ever
  // see their own paired devices, read-only.
  public async findAll(user: AuthenticatedUser, page = 1, limit = 20): Promise<PaginatedResult<DeviceSession>> {
    const qb = this.deviceSessionsRepo
      .createQueryBuilder('device')
      .leftJoinAndSelect('device.employee', 'employee')
      .orderBy('device.createdAt', 'DESC');

    if (user.role !== 'HR' && user.role !== 'ADMIN') {
      qb.andWhere('employee.id = :employeeId', { employeeId: user.sub });
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, page, limit);
  }

  public async revoke(id: number): Promise<void> {
    const session = await this.deviceSessionsRepo.findOne({ where: { id } });
    if (!session) {
      throw new NotFoundException(`Device session ${id} not found`);
    }

    session.isActive = false;
    await this.deviceSessionsRepo.save(session);
  }
}

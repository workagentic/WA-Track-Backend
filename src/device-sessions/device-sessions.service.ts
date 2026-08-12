import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceSession } from './device-session.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { buildPaginatedResult } from '../common/utils/paginate.util';

@Injectable()
export class DeviceSessionsService {
  constructor(@InjectRepository(DeviceSession) private deviceSessionsRepo: Repository<DeviceSession>) {}

  public async findMine(user: AuthenticatedUser, page = 1, limit = 20): Promise<PaginatedResult<DeviceSession>> {
    const [data, total] = await this.deviceSessionsRepo.findAndCount({
      where: { employee: { id: user.sub } },
      order: { lastActive: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return buildPaginatedResult(data, total, page, limit);
  }

  public async revoke(id: number, user: AuthenticatedUser): Promise<void> {
    const session = await this.deviceSessionsRepo.findOne({
      where: { id },
      relations: { employee: true },
    });

    if (!session) {
      throw new NotFoundException(`Device session ${id} not found`);
    }

    const isOwner = session.employee?.id === user.sub;
    const isAdmin = user.role === 'HR' || user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You may only revoke your own devices');
    }

    session.isActive = false;
    await this.deviceSessionsRepo.save(session);
  }
}

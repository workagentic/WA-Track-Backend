import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceSession } from './device-session.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Injectable()
export class DeviceSessionsService {
  constructor(@InjectRepository(DeviceSession) private deviceSessionsRepo: Repository<DeviceSession>) {}

  public findMine(user: AuthenticatedUser): Promise<DeviceSession[]> {
    return this.deviceSessionsRepo.find({
      where: { employee: { id: user.sub } },
      order: { lastActive: 'DESC' },
    });
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

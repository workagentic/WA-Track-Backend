import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtStrategy } from './jwt.strategy';
import { DeviceSession } from '../../device-sessions/device-session.entity';
import { Employee } from '../../employees/employee.entity';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let employeesRepo: { findOne: jest.Mock };
  let deviceSessionsRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    employeesRepo = { findOne: jest.fn() };
    deviceSessionsRepo = { findOne: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: getRepositoryToken(DeviceSession), useValue: deviceSessionsRepo },
        { provide: getRepositoryToken(Employee), useValue: employeesRepo },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('secret') } },
      ],
    }).compile();
    strategy = module.get(JwtStrategy);
  });

  it('rejects a locked employee even with an otherwise valid token', async () => {
    employeesRepo.findOne.mockResolvedValue({ id: 1, status: 'locked' });

    await expect(strategy.validate({ sub: 1 } as any)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when the employee no longer exists (e.g. soft-deleted)', async () => {
    employeesRepo.findOne.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 1 } as any)).rejects.toThrow(UnauthorizedException);
  });

  it('allows an active employee through when there is no device session on the token', async () => {
    employeesRepo.findOne.mockResolvedValue({ id: 1, status: 'active' });

    const payload = { sub: 1 } as any;
    await expect(strategy.validate(payload)).resolves.toBe(payload);
  });

  it('rejects an active employee whose device session has been revoked', async () => {
    employeesRepo.findOne.mockResolvedValue({ id: 1, status: 'active' });
    deviceSessionsRepo.findOne.mockResolvedValue({ id: 7, isActive: false });

    await expect(strategy.validate({ sub: 1, deviceSessionId: 7 } as any)).rejects.toThrow(UnauthorizedException);
  });
});

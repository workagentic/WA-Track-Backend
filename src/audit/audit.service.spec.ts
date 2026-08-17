import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { Employee } from '../employees/employee.entity';
import { Department } from '../departments/department.entity';
import { Client } from '../clients/client.entity';
import { Task } from '../tasks/task.entity';

function makeQb(rows: any[]) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    withDeleted: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
  };
}

describe('AuditService', () => {
  let service: AuditService;
  let employeesRepo: { createQueryBuilder: jest.Mock };
  let departmentsRepo: { createQueryBuilder: jest.Mock };
  let clientsRepo: { createQueryBuilder: jest.Mock };
  let tasksRepo: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    employeesRepo = { createQueryBuilder: jest.fn().mockReturnValue(makeQb([])) };
    departmentsRepo = { createQueryBuilder: jest.fn().mockReturnValue(makeQb([])) };
    clientsRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(
        makeQb([
          {
            id: 7,
            name: 'ABC Company',
            createdAt: new Date('2026-01-10'),
            createdBy: { id: 12, fullName: 'Muhammad Bilal', username: 'bilal.m' },
            deletedAt: new Date('2026-08-12'),
            deletedBy: { id: 4, fullName: 'Sara HR', username: 'sara.hr' },
          },
        ]),
      ),
    };
    tasksRepo = { createQueryBuilder: jest.fn().mockReturnValue(makeQb([])) };

    const module = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(Employee), useValue: employeesRepo },
        { provide: getRepositoryToken(Department), useValue: departmentsRepo },
        { provide: getRepositoryToken(Client), useValue: clientsRepo },
        { provide: getRepositoryToken(Task), useValue: tasksRepo },
      ],
    }).compile();
    service = module.get(AuditService);
  });

  it('returns only the requested entityType, paginated', async () => {
    const results = await service.findDeletions({ entityType: 'client' } as any);
    expect(results.total).toBe(1);
    expect(results.page).toBe(1);
    expect(results.limit).toBe(20);
    expect(results.totalPages).toBe(1);
    expect(results.data).toHaveLength(1);
    expect(results.data[0]).toMatchObject({ entityType: 'client', id: 7, label: 'ABC Company' });
    expect(employeesRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('findOne throws NotFoundException when nothing matches', async () => {
    await expect(service.findOne('task', 999)).rejects.toThrow(NotFoundException);
  });
});

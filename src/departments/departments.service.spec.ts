import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { DepartmentsService } from './departments.service';
import { Department } from './department.entity';
import { Client } from '../clients/client.entity';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let repo: { findOne: jest.Mock; update: jest.Mock; create: jest.Mock; save: jest.Mock };
  let clientsRepo: { count: jest.Mock; update: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      update: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 1, ...x })),
    };
    clientsRepo = { count: jest.fn(), update: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        { provide: getRepositoryToken(Department), useValue: repo },
        { provide: getRepositoryToken(Client), useValue: clientsRepo },
      ],
    }).compile();
    service = module.get(DepartmentsService);
  });

  it('sets deletedAt and deletedBy on softDelete when there are no active clients', async () => {
    repo.findOne.mockResolvedValue({ id: 3 });
    clientsRepo.count.mockResolvedValue(0);
    await service.softDelete(3, 9, false);
    expect(repo.update).toHaveBeenCalledWith(3, { deletedAt: expect.any(Date), deletedBy: { id: 9 } });
  });

  it('throws NotFoundException restoring a non-existent department', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.restore(99)).rejects.toThrow(NotFoundException);
  });

  it('blocks softDelete when the department has active clients and force is not set', async () => {
    repo.findOne.mockResolvedValue({ id: 3 });
    clientsRepo.count.mockResolvedValue(2);
    await expect(service.softDelete(3, 9, false)).rejects.toThrow(ConflictException);
  });

  it('cascades softDelete to active clients when force is true', async () => {
    repo.findOne.mockResolvedValue({ id: 3 });
    clientsRepo.count.mockResolvedValue(2);
    await service.softDelete(3, 9, true);
    expect(clientsRepo.update).toHaveBeenCalledWith(
      { department: { id: 3 } },
      { deletedAt: expect.any(Date), deletedBy: { id: 9 } },
    );
    expect(repo.update).toHaveBeenCalledWith(3, { deletedAt: expect.any(Date), deletedBy: { id: 9 } });
  });

  it('throws ConflictException when creating a department with a name that already exists', async () => {
    repo.findOne.mockResolvedValue({ id: 5, name: 'Engineering' });

    await expect(service.create({ name: 'Engineering' } as any)).rejects.toThrow(
      new ConflictException('A department named "Engineering" already exists'),
    );
  });

  it('creates a department when the name is available', async () => {
    repo.findOne.mockResolvedValue(null);

    await service.create({ name: 'Engineering' } as any);

    expect(repo.create).toHaveBeenCalledWith({ name: 'Engineering' });
  });

  it('translates a duplicate-key DB error into a ConflictException when the pre-check race loses', async () => {
    repo.findOne.mockResolvedValue(null);
    const dbError = new QueryFailedError('INSERT INTO "departments" ...', [], {
      code: '23505',
      constraint: 'UQ_departments_name_active',
    } as any);
    repo.save.mockRejectedValueOnce(dbError);

    await expect(service.create({ name: 'Engineering' } as any)).rejects.toThrow(
      new ConflictException('A department with this name already exists'),
    );
  });

  it('throws ConflictException when renaming a department to a name already used by another department', async () => {
    repo.findOne
      .mockResolvedValueOnce({ id: 3, name: 'Engineering' })
      .mockResolvedValueOnce({ id: 9, name: 'Sales' });

    await expect(service.update(3, { name: 'Sales' } as any)).rejects.toThrow(
      new ConflictException('A department named "Sales" already exists'),
    );
  });

  it('does not check for a duplicate name when the update DTO name is unchanged', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 3, name: 'Engineering' });

    await service.update(3, { name: 'Engineering' } as any);

    expect(repo.findOne).toHaveBeenCalledTimes(1);
  });
});

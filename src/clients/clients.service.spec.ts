import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { ClientsService } from './clients.service';
import { Client } from './client.entity';
import { Task } from '../tasks/task.entity';

function makeQb(rows: any[], total: number) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    withDeleted: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
  };
}

describe('ClientsService', () => {
  let service: ClientsService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let tasksRepo: { count: jest.Mock; update: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 1, ...x })),
      findOne: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    tasksRepo = { count: jest.fn(), update: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: getRepositoryToken(Client), useValue: repo },
        { provide: getRepositoryToken(Task), useValue: tasksRepo },
      ],
    }).compile();
    service = module.get(ClientsService);
  });

  it('creates a client scoped to the department in the DTO', async () => {
    const user = { sub: 12, role: 'HR', departmentId: 3 } as any;
    await service.create({ name: 'ABC Company', departmentId: 3 } as any, user);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ABC Company', department: { id: 3 }, createdBy: { id: 12 } }),
    );
  });

  it('blocks a MANAGER from creating a client outside their own department', async () => {
    const user = { sub: 12, role: 'MANAGER', departmentId: 3 } as any;
    await expect(
      service.create({ name: 'ABC Company', departmentId: 9 } as any, user),
    ).rejects.toThrow(ForbiddenException);
  });

  it('scopes findAll to the department for role EMPLOYEE — never other departments', async () => {
    const qb = makeQb([{ id: 1 }], 1);
    repo.createQueryBuilder.mockReturnValue(qb);
    const user = { sub: 1, role: 'EMPLOYEE', departmentId: 5 } as any;

    await service.findAll(user);

    expect(qb.andWhere).toHaveBeenCalledWith('department.id = :departmentId', { departmentId: 5 });
  });

  it('does not scope findAll for HR/ADMIN — org-wide visibility', async () => {
    const qb = makeQb([{ id: 1 }, { id: 2 }], 2);
    repo.createQueryBuilder.mockReturnValue(qb);
    const user = { sub: 1, role: 'HR', departmentId: 5 } as any;

    await service.findAll(user);

    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('throws ConflictException when a client with the same name already exists in the department', async () => {
    repo.findOne.mockResolvedValue({ id: 5, name: 'ABC Company' });
    const user = { sub: 12, role: 'HR', departmentId: 3 } as any;

    await expect(
      service.create({ name: 'ABC Company', departmentId: 3 } as any, user),
    ).rejects.toThrow(new ConflictException('A client named "ABC Company" already exists in this department'));
  });

  it('translates a duplicate-key DB error into a ConflictException when the pre-check race loses', async () => {
    repo.findOne.mockResolvedValue(null);
    const dbError = new QueryFailedError('INSERT INTO "clients" ...', [], {
      code: '23505',
      constraint: 'UQ_clients_name_department_active',
    } as any);
    repo.save.mockRejectedValueOnce(dbError);
    const user = { sub: 12, role: 'HR', departmentId: 3 } as any;

    await expect(
      service.create({ name: 'ABC Company', departmentId: 3 } as any, user),
    ).rejects.toThrow(new ConflictException('A client with this name already exists in this department'));
  });

  it('throws ConflictException when renaming a client to a name already used in the same department', async () => {
    repo.findOne
      .mockResolvedValueOnce({ id: 7, name: 'ABC Company', department: { id: 3 } })
      .mockResolvedValueOnce({ id: 9, name: 'XYZ Company' });
    const user = { sub: 12, role: 'HR', departmentId: 3 } as any;

    await expect(
      service.update(7, { name: 'XYZ Company' } as any, user),
    ).rejects.toThrow(new ConflictException('A client named "XYZ Company" already exists in this department'));
  });

  it('does not check for a duplicate name when the update DTO name is unchanged', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 7, name: 'ABC Company', department: { id: 3 } });
    const user = { sub: 12, role: 'HR', departmentId: 3 } as any;

    await service.update(7, { name: 'ABC Company' } as any, user);

    expect(repo.findOne).toHaveBeenCalledTimes(1);
  });

  it('moves a client to a new department when departmentId changes', async () => {
    repo.findOne
      .mockResolvedValueOnce({ id: 7, name: 'ABC Company', department: { id: 3 } })
      .mockResolvedValueOnce(null);
    const user = { sub: 12, role: 'HR', departmentId: 3 } as any;

    await service.update(7, { departmentId: 9 } as any, user);

    expect(repo.findOne).toHaveBeenNthCalledWith(2, { where: { name: 'ABC Company', department: { id: 9 } } });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, department: { id: 9 } }),
    );
  });

  it('blocks a MANAGER from moving a client to a different department', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 7, name: 'ABC Company', department: { id: 3 } });
    const user = { sub: 12, role: 'MANAGER', departmentId: 3 } as any;

    await expect(service.update(7, { departmentId: 9 } as any, user)).rejects.toThrow(ForbiddenException);
  });

  it('throws ConflictException moving a client into a department that already has that name', async () => {
    repo.findOne
      .mockResolvedValueOnce({ id: 7, name: 'ABC Company', department: { id: 3 } })
      .mockResolvedValueOnce({ id: 20, name: 'ABC Company' });
    const user = { sub: 12, role: 'HR', departmentId: 3 } as any;

    await expect(
      service.update(7, { departmentId: 9 } as any, user),
    ).rejects.toThrow(new ConflictException('A client named "ABC Company" already exists in this department'));
  });

  it('blocks softDelete when the client has active tasks and force is not set', async () => {
    repo.findOne.mockResolvedValue({ id: 7 });
    tasksRepo.count.mockResolvedValue(2);
    await expect(service.softDelete(7, 9, false)).rejects.toThrow(ConflictException);
  });

  it('cascades softDelete to active tasks when force is true', async () => {
    repo.findOne.mockResolvedValue({ id: 7 });
    tasksRepo.count.mockResolvedValue(2);
    await service.softDelete(7, 9, true);
    expect(tasksRepo.update).toHaveBeenCalledWith(
      { client: { id: 7 } },
      { deletedAt: expect.any(Date), deletedBy: { id: 9 } },
    );
    expect(repo.update).toHaveBeenCalledWith(7, { deletedAt: expect.any(Date), deletedBy: { id: 9 } });
  });
});

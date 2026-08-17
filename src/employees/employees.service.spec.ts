import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { EmployeesService } from './employees.service';
import { Employee } from './employee.entity';

function makeQb(rows: any[], total: number) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
  };
}

describe('EmployeesService', () => {
  let service: EmployeesService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 1, ...x })),
      update: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: getRepositoryToken(Employee), useValue: repo },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(12) } },
      ],
    }).compile();
    service = module.get(EmployeesService);
  });

  it('persists username on create', async () => {
    await service.create({
      fullName: 'Jane Doe',
      email: 'jane@company.com',
      username: 'jane.doe',
      password: 'StrongPassw0rd!',
      departmentId: 1,
      roleId: 1,
    } as any);

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ username: 'jane.doe' }));
  });

  it('sets deletedAt and deletedBy on softDelete', async () => {
    repo.findOne.mockResolvedValue({ id: 5 });
    await service.softDelete(5, 9);
    expect(repo.update).toHaveBeenCalledWith(5, {
      deletedAt: expect.any(Date),
      deletedBy: { id: 9 },
    });
  });

  it('throws NotFoundException restoring a non-existent employee', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.restore(99)).rejects.toThrow(NotFoundException);
  });

  it('clears deletedAt and deletedBy on restore', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 5, deletedAt: new Date() }).mockResolvedValueOnce({ id: 5 });
    await service.restore(5);
    expect(repo.update).toHaveBeenCalledWith(5, { deletedAt: null, deletedBy: null });
  });

  it('throws ConflictException("Email is already registered") when creating with a duplicate email', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 2, email: 'jane@company.com' }).mockResolvedValueOnce(null);

    await expect(
      service.create({
        fullName: 'Jane Doe',
        email: 'jane@company.com',
        username: 'jane.doe',
        password: 'StrongPassw0rd!',
        departmentId: 1,
        roleId: 1,
      } as any),
    ).rejects.toThrow(new ConflictException('Email is already registered'));
  });

  it('throws ConflictException("Username is already taken") when creating with a duplicate username', async () => {
    repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 3, username: 'jane.doe' });

    await expect(
      service.create({
        fullName: 'Jane Doe',
        email: 'jane2@company.com',
        username: 'jane.doe',
        password: 'StrongPassw0rd!',
        departmentId: 1,
        roleId: 1,
      } as any),
    ).rejects.toThrow(new ConflictException('Username is already taken'));
  });

  it('throws a combined ConflictException when both email and username are already taken', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 2 }).mockResolvedValueOnce({ id: 3 });

    await expect(
      service.create({
        fullName: 'Jane Doe',
        email: 'jane@company.com',
        username: 'jane.doe',
        password: 'StrongPassw0rd!',
        departmentId: 1,
        roleId: 1,
      } as any),
    ).rejects.toThrow(new ConflictException('Email and username are already registered'));
  });

  it('translates a duplicate-key DB error into a ConflictException when the pre-check race loses', async () => {
    repo.findOne.mockResolvedValue(null);
    const dbError = new QueryFailedError('INSERT INTO "employees" ...', [], {
      code: '23505',
      constraint: 'UQ_employees_email_active',
    } as any);
    repo.save.mockRejectedValueOnce(dbError);

    await expect(
      service.create({
        fullName: 'Jane Doe',
        email: 'jane@company.com',
        username: 'jane.doe',
        password: 'StrongPassw0rd!',
        departmentId: 1,
        roleId: 1,
      } as any),
    ).rejects.toThrow(new ConflictException('Email is already registered'));
  });

  it('throws ConflictException when updating to an email already used by another employee', async () => {
    repo.findOne
      .mockResolvedValueOnce({ id: 5, email: 'old@company.com', department: { id: 1 } })
      .mockResolvedValueOnce({ id: 9, email: 'taken@company.com' });

    await expect(
      service.update(5, { email: 'taken@company.com' } as any),
    ).rejects.toThrow(new ConflictException('Email is already registered'));
  });

  it('does not check for a duplicate when the email in the update DTO is unchanged', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 5, email: 'same@company.com', department: { id: 1 } });

    await service.update(5, { email: 'same@company.com' } as any);

    expect(repo.findOne).toHaveBeenCalledTimes(1);
  });

  it('scopes findAll to only themselves for role EMPLOYEE, never the org-wide count', async () => {
    const qb = makeQb([{ id: 7 }], 1);
    repo.createQueryBuilder.mockReturnValue(qb);
    const user = { sub: 7, role: 'EMPLOYEE', departmentId: 1 } as any;

    const result = await service.findAll(user);

    expect(qb.where).toHaveBeenCalledWith('employee.id = :employeeId', { employeeId: 7 });
    expect(result.total).toBe(1);
  });

  it('scopes findAll to the department for role MANAGER', async () => {
    const qb = makeQb([{ id: 1 }, { id: 2 }, { id: 3 }], 3);
    repo.createQueryBuilder.mockReturnValue(qb);
    const user = { sub: 1, role: 'MANAGER', departmentId: 4 } as any;

    const result = await service.findAll(user);

    expect(qb.where).toHaveBeenCalledWith('department.id = :departmentId', { departmentId: 4 });
    expect(result.total).toBe(3);
  });

  it('does not scope findAll for HR/ADMIN — org-wide visibility', async () => {
    const qb = makeQb([{ id: 1 }, { id: 2 }], 2);
    repo.createQueryBuilder.mockReturnValue(qb);
    const user = { sub: 1, role: 'HR', departmentId: 1 } as any;

    const result = await service.findAll(user);

    expect(qb.where).not.toHaveBeenCalled();
    expect(result.total).toBe(2);
  });
});

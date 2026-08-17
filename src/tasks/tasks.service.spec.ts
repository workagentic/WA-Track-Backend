import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { Task } from './task.entity';
import { TimeEntry } from '../time-entries/time-entry.entity';
import { Client } from '../clients/client.entity';

describe('TasksService', () => {
  let service: TasksService;
  let tasksRepo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock; update: jest.Mock };
  let timeEntriesRepo: Record<string, jest.Mock>;
  let clientsRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    tasksRepo = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 1, ...x })),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    timeEntriesRepo = {};
    clientsRepo = { findOne: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task), useValue: tasksRepo },
        { provide: getRepositoryToken(TimeEntry), useValue: timeEntriesRepo },
        { provide: getRepositoryToken(Client), useValue: clientsRepo },
      ],
    }).compile();
    service = module.get(TasksService);
  });

  it('creates a task without a status field', async () => {
    const user = { sub: 1, role: 'HR', departmentId: 1 } as any;
    const task = await service.create(
      { title: 'Build API', departmentId: 1, clientId: 7 } as any,
      user,
    );
    expect(task).not.toHaveProperty('status');
    expect(tasksRepo.create).toHaveBeenCalledWith(expect.objectContaining({ client: { id: 7 } }));
  });

  it('assigns a client to a task', async () => {
    tasksRepo.findOne.mockResolvedValue({ id: 1, department: { id: 1 } });
    clientsRepo.findOne.mockResolvedValue({ id: 7, department: { id: 1 } });
    const user = { sub: 1, role: 'HR', departmentId: 1 } as any;

    const task = await service.assignClient(1, { clientId: 7 } as any, user);
    expect(task.client).toEqual({ id: 7, department: { id: 1 } });
  });

  it('throws NotFoundException assigning a non-existent client', async () => {
    tasksRepo.findOne.mockResolvedValue({ id: 1, department: { id: 1 } });
    clientsRepo.findOne.mockResolvedValue(null);
    const user = { sub: 1, role: 'HR', departmentId: 1 } as any;

    await expect(service.assignClient(1, { clientId: 99 } as any, user)).rejects.toThrow(NotFoundException);
  });

  it('sets deletedAt and deletedBy on softDelete', async () => {
    tasksRepo.findOne.mockResolvedValue({ id: 1, department: { id: 1 } });
    const user = { sub: 9, role: 'HR', departmentId: 1 } as any;
    await service.softDelete(1, user);
    expect(tasksRepo.update).toHaveBeenCalledWith(1, { deletedAt: expect.any(Date), deletedBy: { id: 9 } });
  });

  it('blocks a MANAGER from deleting a task outside their department', async () => {
    tasksRepo.findOne.mockResolvedValue({ id: 1, department: { id: 2 } });
    const user = { sub: 9, role: 'MANAGER', departmentId: 1 } as any;
    await expect(service.softDelete(1, user)).rejects.toThrow(ForbiddenException);
    expect(tasksRepo.update).not.toHaveBeenCalled();
  });

  it('allows a MANAGER to delete a task within their department', async () => {
    tasksRepo.findOne.mockResolvedValue({ id: 1, department: { id: 1 } });
    const user = { sub: 9, role: 'MANAGER', departmentId: 1 } as any;
    await service.softDelete(1, user);
    expect(tasksRepo.update).toHaveBeenCalledWith(1, { deletedAt: expect.any(Date), deletedBy: { id: 9 } });
  });

  it('restores a task and clears deletedAt/deletedBy', async () => {
    tasksRepo.findOne.mockResolvedValueOnce({ id: 1, department: { id: 1 } });
    tasksRepo.findOne.mockResolvedValueOnce({ id: 1, department: { id: 1 } });
    const user = { sub: 9, role: 'HR', departmentId: 1 } as any;
    await service.restore(1, user);
    expect(tasksRepo.update).toHaveBeenCalledWith(1, { deletedAt: null, deletedBy: null });
  });

  it('blocks a MANAGER from restoring a task outside their department', async () => {
    tasksRepo.findOne.mockResolvedValue({ id: 1, department: { id: 2 } });
    const user = { sub: 9, role: 'MANAGER', departmentId: 1 } as any;
    await expect(service.restore(1, user)).rejects.toThrow(ForbiddenException);
    expect(tasksRepo.update).not.toHaveBeenCalled();
  });

  it('allows a MANAGER to restore a task within their department', async () => {
    tasksRepo.findOne.mockResolvedValueOnce({ id: 1, department: { id: 1 } });
    tasksRepo.findOne.mockResolvedValueOnce({ id: 1, department: { id: 1 } });
    const user = { sub: 9, role: 'MANAGER', departmentId: 1 } as any;
    await service.restore(1, user);
    expect(tasksRepo.update).toHaveBeenCalledWith(1, { deletedAt: null, deletedBy: null });
  });
});

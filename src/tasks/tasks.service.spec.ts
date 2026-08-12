import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
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
      { title: 'Build API', departmentId: 1, assignedToId: 2, clientId: 7 } as any,
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
    tasksRepo.findOne.mockResolvedValue({ id: 1 });
    await service.softDelete(1, 9);
    expect(tasksRepo.update).toHaveBeenCalledWith(1, { deletedAt: expect.any(Date), deletedBy: { id: 9 } });
  });
});

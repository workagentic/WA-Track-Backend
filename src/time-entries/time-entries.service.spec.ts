import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TimeEntriesService } from './time-entries.service';
import { TimeEntry } from './time-entry.entity';
import { TimeEntryAudit } from './time-entry-audit.entity';
import { Employee } from '../employees/employee.entity';
import { Task } from '../tasks/task.entity';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const HR_USER: AuthenticatedUser = { sub: 99, email: 'hr@co.local', fullName: 'Sara HR', role: 'HR', departmentId: null };

describe('TimeEntriesService', () => {
  let service: TimeEntriesService;
  let timeEntriesRepo: Record<string, jest.Mock>;
  let timeEntryAuditsRepo: Record<string, jest.Mock>;
  let employeesRepo: Record<string, jest.Mock>;
  let tasksRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    timeEntriesRepo = {
      findOne: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ id: 1, ...v })),
    };
    timeEntryAuditsRepo = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
      find: jest.fn(),
    };
    employeesRepo = { findOneBy: jest.fn().mockResolvedValue({ id: 1 }) };
    tasksRepo = { findOneBy: jest.fn().mockResolvedValue({ id: 1 }) };

    const module = await Test.createTestingModule({
      providers: [
        TimeEntriesService,
        { provide: getRepositoryToken(TimeEntry), useValue: timeEntriesRepo },
        { provide: getRepositoryToken(TimeEntryAudit), useValue: timeEntryAuditsRepo },
        { provide: getRepositoryToken(Employee), useValue: employeesRepo },
        { provide: getRepositoryToken(Task), useValue: tasksRepo },
      ],
    }).compile();
    service = module.get(TimeEntriesService);
  });

  describe('sync', () => {
    it('skips (does not overwrite) an entry already flagged manuallyEdited', async () => {
      timeEntriesRepo.findOne.mockResolvedValue({ id: 5, localId: 'abc', manuallyEdited: true, durationSeconds: 18000 });

      await service.sync(
        { entries: [{ localId: 'abc', taskId: 1, employeeId: 99, startTime: '2026-08-19T00:00:00Z', durationSeconds: 999 }] } as any,
        HR_USER,
      );

      expect(timeEntriesRepo.save).not.toHaveBeenCalled();
    });

    it('upserts a normal (non-manually-edited) entry as before', async () => {
      timeEntriesRepo.findOne.mockResolvedValue(null);

      await service.sync(
        { entries: [{ localId: 'new-1', taskId: 1, employeeId: 99, startTime: '2026-08-19T00:00:00Z', durationSeconds: 100 }] } as any,
        HR_USER,
      );

      expect(timeEntriesRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('createManual', () => {
    it('creates a manuallyEdited entry with a synthetic localId and writes an audit row', async () => {
      timeEntriesRepo.findOne.mockResolvedValue({ id: 1, employee: {}, task: {} });

      await service.createManual(
        { employeeId: 1, taskId: 1, date: '2026-08-19', durationSeconds: 18000, reason: 'employee-reported' },
        HR_USER,
      );

      const savedEntry = timeEntriesRepo.save.mock.calls[0][0];
      expect(savedEntry.manuallyEdited).toBe(true);
      expect(savedEntry.localId).toMatch(/^manual-/);

      const savedAudit = timeEntryAuditsRepo.save.mock.calls[0][0];
      expect(savedAudit.previousDurationSeconds).toBe(0);
      expect(savedAudit.newDurationSeconds).toBe(18000);
      expect(savedAudit.reason).toBe('employee-reported');
    });

    it('rejects an unknown employee id', async () => {
      employeesRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.createManual({ employeeId: 999, taskId: 1, date: '2026-08-19', durationSeconds: 100 }, HR_USER),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('records the previous and new duration in an audit row', async () => {
      timeEntriesRepo.findOne.mockResolvedValue({
        id: 5,
        durationSeconds: 10800,
        startTime: new Date('2026-08-19T00:00:00Z'),
        employee: {},
        task: {},
      });

      await service.update(5, { durationSeconds: 18000, reason: 'employee-reported correction' }, HR_USER);

      const savedAudit = timeEntryAuditsRepo.save.mock.calls[0][0];
      expect(savedAudit.previousDurationSeconds).toBe(10800);
      expect(savedAudit.newDurationSeconds).toBe(18000);

      const savedEntry = timeEntriesRepo.save.mock.calls[0][0];
      expect(savedEntry.manuallyEdited).toBe(true);
    });

    it('throws NotFoundException for an unknown entry id', async () => {
      timeEntriesRepo.findOne.mockResolvedValue(null);
      await expect(service.update(404, { durationSeconds: 1, reason: 'x' }, HR_USER)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

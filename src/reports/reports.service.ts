import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import { TimeEntry } from '../time-entries/time-entry.entity';
import { ExportReportQueryDto } from './dto/export-report-query.dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Injectable()
export class ReportsService {
  constructor(@InjectRepository(TimeEntry) private timeEntriesRepo: Repository<TimeEntry>) {}

  async buildExportWorkbook(query: ExportReportQueryDto, user: AuthenticatedUser): Promise<ExcelJS.Workbook> {
    let departmentId = query.departmentId;

    if (user.role === 'MANAGER') {
      if (departmentId && departmentId !== user.departmentId) {
        throw new ForbiddenException('Managers may only export reports for their own department');
      }
      departmentId = user.departmentId ?? undefined;
    }

    const qb = this.timeEntriesRepo
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.employee', 'employee')
      .leftJoinAndSelect('employee.department', 'department')
      .leftJoinAndSelect('entry.task', 'task')
      .orderBy('entry.startTime', 'ASC');

    if (departmentId) {
      qb.andWhere('department.id = :departmentId', { departmentId });
    }

    if (query.from) {
      qb.andWhere('entry.startTime >= :from', { from: query.from });
    }

    if (query.to) {
      qb.andWhere('entry.startTime <= :to', { to: query.to });
    }

    const entries = await qb.getMany();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TimeCamp';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Time Entries');
    sheet.columns = [
      { header: 'Employee', key: 'employee', width: 28 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Task', key: 'task', width: 32 },
      { header: 'Start', key: 'start', width: 22 },
      { header: 'End', key: 'end', width: 22 },
      { header: 'Duration (hrs)', key: 'durationHours', width: 16 },
      { header: 'Sync Status', key: 'syncStatus', width: 14 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const entry of entries) {
      sheet.addRow({
        employee: entry.employee?.fullName ?? '',
        department: entry.employee?.department?.name ?? '',
        task: entry.task?.title ?? '',
        start: entry.startTime,
        end: entry.endTime ?? '',
        durationHours: Number((entry.durationSeconds / 3600).toFixed(2)),
        syncStatus: entry.syncStatus,
      });
    }

    const totalRow = sheet.addRow({
      employee: 'TOTAL',
      durationHours: Number((entries.reduce((sum, e) => sum + e.durationSeconds, 0) / 3600).toFixed(2)),
    });
    totalRow.font = { bold: true };

    return workbook;
  }
}

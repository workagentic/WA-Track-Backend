import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { In, Repository } from 'typeorm';
import { TimeEntry } from '../time-entries/time-entry.entity';
import { Employee } from '../employees/employee.entity';
import { ExportReportQueryDto } from './dto/export-report-query.dto';
import { enumerateDateKeys } from './utils/report-date.util';
import { buildPivot } from './utils/report-pivot.util';
import { writeMetaBlock, writePivotTable } from './utils/report-sheet.util';
import { toInclusiveEndOfDay } from '../common/utils/date-range.util';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(TimeEntry) private timeEntriesRepo: Repository<TimeEntry>,
    @InjectRepository(Employee) private employeesRepo: Repository<Employee>,
  ) {}

  async buildExportWorkbook(query: ExportReportQueryDto): Promise<ExcelJS.Workbook> {
    const departmentId = query.departmentId;
    const employeeIds = query.employeeIds;

    let selectedEmployeeNames: string[] = [];
    if (employeeIds && employeeIds.length > 0) {
      const found = await this.employeesRepo.findBy({ id: In(employeeIds) });
      const foundIds = new Set(found.map((e) => e.id));
      const missing = employeeIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        throw new BadRequestException(`Unknown employee id(s): ${missing.join(', ')}`);
      }
      selectedEmployeeNames = found.map((e) => e.fullName).sort((a, b) => a.localeCompare(b));
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
    if (employeeIds && employeeIds.length > 0) {
      qb.andWhere('employee.id IN (:...employeeIds)', { employeeIds });
    }
    if (query.from) {
      qb.andWhere('entry.startTime >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('entry.startTime <= :to', { to: toInclusiveEndOfDay(query.to) });
    }

    const entries = await qb.getMany();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'WA Track';
    workbook.created = new Date();

    let peopleLabel = 'All';
    if (selectedEmployeeNames.length > 0) {
      peopleLabel = selectedEmployeeNames.join(', ');
    } else if (departmentId) {
      peopleLabel = entries[0]?.employee?.department?.name ?? `Department #${departmentId}`;
    }

    const dateKeys = enumerateDateKeys(query.from, query.to, entries);
    const employeeGroups = buildPivot(entries);

    // One workbook, two tabs — hours (formatted) and decimal — instead of
    // two separate downloads. Same underlying entries/pivot for both; only
    // the cell rendering differs (see writePivotTable's `decimal` flag).
    const hoursSheet = workbook.addWorksheet('Time Report');
    const hoursStartRow = writeMetaBlock(hoursSheet, { from: query.from, to: query.to, peopleLabel }) + 2;
    writePivotTable(hoursSheet, hoursStartRow, dateKeys, employeeGroups, false);

    const decimalSheet = workbook.addWorksheet('Time Report (Decimal)');
    writePivotTable(decimalSheet, 1, dateKeys, employeeGroups, true);

    return workbook;
  }
}

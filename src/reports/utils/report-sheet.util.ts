import * as ExcelJS from 'exceljs';
import type { EmployeeGroup } from '../interfaces/report-pivot.interface';
import { TASK_NAME_COLOR, THIN_BORDER } from '../constant/report.constant';
import { dateKeyLabel, formatGenerated } from './report-date.util';

/** Formats seconds as "Xh Ym", matching the reference report — zero duration renders as "0s" rather than "0h 00m". */
function formatDurationHm(seconds: number): string {
  if (seconds <= 0) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

/** The "Time frame / Projects / People / Grouped by" metadata box above the pivot table. Returns the last row it used. */
export function writeMetaBlock(sheet: ExcelJS.Worksheet, meta: { from?: string; to?: string; peopleLabel: string }): number {
  sheet.getCell('A1').value = 'Time frame';
  sheet.mergeCells('A1:B2');
  sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };

  sheet.getCell('C1').value = 'From';
  sheet.getCell('D1').value = meta.from ?? '';
  sheet.getCell('C2').value = 'To';
  sheet.getCell('D2').value = meta.to ?? '';

  sheet.getCell('F1').value = 'Projects';
  sheet.getCell('G1').value = 'All';
  sheet.getCell('F2').value = 'People';
  sheet.getCell('G2').value = meta.peopleLabel;

  sheet.getCell('A3').value = 'Generated';
  sheet.mergeCells('C3:D3');
  sheet.getCell('C3').value = formatGenerated(new Date());
  sheet.getCell('F3').value = 'Grouped by';
  sheet.getCell('G3').value = '';

  for (const addr of ['A1', 'A3', 'C1', 'C2', 'F1', 'F2', 'F3']) {
    sheet.getCell(addr).font = { bold: true };
  }
  for (let r = 1; r <= 3; r++) {
    for (const col of ['A', 'B', 'C', 'D', 'F', 'G']) {
      sheet.getCell(`${col}${r}`).border = THIN_BORDER;
    }
  }

  return 3;
}

/** The People x day-column pivot table (task subtotal rows + a bold Total row per employee). */
export function writePivotTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  dateKeys: string[],
  employeeGroups: EmployeeGroup[],
  decimal: boolean,
): void {
  const lastCol = 2 + dateKeys.length;
  const cellValue = (seconds: number) => (decimal ? Number((seconds / 3600).toFixed(2)) : formatDurationHm(seconds));

  const headerRow = sheet.getRow(startRow);
  headerRow.getCell(1).value = 'People';
  dateKeys.forEach((key, i) => (headerRow.getCell(2 + i).value = dateKeyLabel(key)));
  headerRow.getCell(lastCol).value = 'Total';
  headerRow.font = { bold: true };

  if (!decimal) {
    sheet.autoFilter = { from: { row: startRow, column: 1 }, to: { row: startRow, column: lastCol } };
  }

  sheet.getColumn(1).width = 42;
  for (let c = 2; c <= lastCol; c++) sheet.getColumn(c).width = 10;

  let rowNum = startRow + 1;

  if (employeeGroups.length === 0) {
    sheet.getRow(rowNum).getCell(1).value = 'No time entries in this period.';
    rowNum++;
  }

  for (const emp of employeeGroups) {
    sheet.getRow(rowNum).getCell(1).value = emp.employeeName;
    sheet.getRow(rowNum).font = { bold: true };
    rowNum++;

    const sortedTasks = Array.from(emp.tasks.values()).sort((a, b) => a.taskTitle.localeCompare(b.taskTitle));
    for (const task of sortedTasks) {
      const taskRow = sheet.getRow(rowNum++);
      taskRow.getCell(1).value = task.taskTitle;
      if (!decimal) taskRow.getCell(1).font = { color: { argb: TASK_NAME_COLOR } };
      dateKeys.forEach((key, i) => (taskRow.getCell(2 + i).value = cellValue(task.byDay.get(key) ?? 0)));
      taskRow.getCell(lastCol).value = cellValue(task.totalSeconds);
    }

    const totalRow = sheet.getRow(rowNum++);
    totalRow.getCell(1).value = 'Total';
    dateKeys.forEach((key, i) => (totalRow.getCell(2 + i).value = cellValue(emp.byDay.get(key) ?? 0)));
    totalRow.getCell(lastCol).value = cellValue(emp.totalSeconds);
    totalRow.font = { bold: true };

    rowNum++; // blank separator row between employees
  }

  const lastRow = rowNum - 1;
  for (let r = startRow; r <= lastRow; r++) {
    for (let c = 1; c <= lastCol; c++) {
      sheet.getCell(r, c).border = THIN_BORDER;
    }
  }
}

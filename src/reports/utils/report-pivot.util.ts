import { TimeEntry } from '../../time-entries/time-entry.entity';
import type { EmployeeGroup } from '../interfaces/report-pivot.interface';
import { toDateKey } from './report-date.util';

/** Groups flat time entries into employee -> task -> day totals, sorted by employee name. */
export function buildPivot(entries: TimeEntry[]): EmployeeGroup[] {
  const employees = new Map<number, EmployeeGroup>();

  for (const entry of entries) {
    const employeeId = entry.employee?.id ?? 0;
    const employeeName = entry.employee?.fullName ?? `Employee #${employeeId}`;
    const taskId = entry.task?.id ?? 0;
    const taskTitle = entry.task?.title ?? `Task #${taskId}`;
    const dateKey = toDateKey(entry.startTime);

    if (!employees.has(employeeId)) {
      employees.set(employeeId, { employeeName, tasks: new Map(), byDay: new Map(), totalSeconds: 0 });
    }
    const emp = employees.get(employeeId)!;

    if (!emp.tasks.has(taskId)) {
      emp.tasks.set(taskId, { taskTitle, byDay: new Map(), totalSeconds: 0 });
    }
    const task = emp.tasks.get(taskId)!;

    task.byDay.set(dateKey, (task.byDay.get(dateKey) ?? 0) + entry.durationSeconds);
    task.totalSeconds += entry.durationSeconds;
    emp.byDay.set(dateKey, (emp.byDay.get(dateKey) ?? 0) + entry.durationSeconds);
    emp.totalSeconds += entry.durationSeconds;
  }

  return Array.from(employees.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

export interface TaskRow {
  taskTitle: string;
  byDay: Map<string, number>;
  totalSeconds: number;
}

export interface EmployeeGroup {
  employeeName: string;
  tasks: Map<number, TaskRow>;
  byDay: Map<string, number>;
  totalSeconds: number;
}

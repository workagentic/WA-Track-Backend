import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Department } from '../departments/department.entity';
import { Employee } from '../employees/employee.entity';
import { TimeEntry } from '../time-entries/time-entry.entity';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ default: 'open' })
  status!: string; // open | in_progress | done | archived

  @Column({ type: 'date', nullable: true })
  dueDate!: Date;

  @ManyToOne(() => Department, (d) => d.tasks)
  department!: Department;

  @ManyToOne(() => Employee, (e) => e.assignedTasks)
  assignedTo!: Employee;

  @ManyToOne(() => Employee)
  createdBy!: Employee;

  @OneToMany(() => TimeEntry, (te) => te.task)
  timeEntries!: TimeEntry[];
}

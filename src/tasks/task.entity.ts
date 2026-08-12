import { Column, DeleteDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Client } from '../clients/client.entity';
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

  @ManyToOne(() => Department, (d) => d.tasks)
  department!: Department;

  @ManyToOne(() => Employee, (e) => e.assignedTasks)
  assignedTo!: Employee;

  @ManyToOne(() => Employee)
  createdBy!: Employee;

  @ManyToOne(() => Client, (c) => c.tasks, { nullable: true })
  client!: Client | null;

  @OneToMany(() => TimeEntry, (te) => te.task)
  timeEntries!: TimeEntry[];

  @DeleteDateColumn()
  deletedAt!: Date | null;

  @ManyToOne(() => Employee, { nullable: true })
  deletedBy!: Employee | null;
}

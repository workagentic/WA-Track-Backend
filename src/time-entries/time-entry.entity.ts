import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { Task } from '../tasks/task.entity';

@Entity('time_entries')
export class TimeEntry {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Employee, (e) => e.timeEntries)
  employee!: Employee;

  @ManyToOne(() => Task, (t) => t.timeEntries)
  task!: Task;

  @Column({ type: 'timestamptz' })
  startTime!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endTime!: Date;

  @Column({ type: 'int', default: 0 })
  durationSeconds!: number;

  @Column({ default: 'pending' })
  syncStatus!: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastHeartbeat!: Date;

  @Column({ unique: true })
  localId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

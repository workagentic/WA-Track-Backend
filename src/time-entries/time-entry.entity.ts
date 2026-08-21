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

  // Once true, sync() permanently refuses to let a desktop-app resync of
  // this localId overwrite it — HR's correction is authoritative from this
  // point on. See TIME_ENTRY_AUDIT_MECHANICS.md for the full reasoning.
  @Column({ default: false })
  manuallyEdited!: boolean;

  @ManyToOne(() => Employee, { nullable: true })
  editedBy!: Employee | null;

  @Column({ type: 'timestamptz', nullable: true })
  editedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

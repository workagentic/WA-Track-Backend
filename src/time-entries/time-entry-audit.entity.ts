import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { TimeEntry } from './time-entry.entity';

// One row per HR edit (not one row per entry) - a real history, not an
// overwritten "last edit" field. See TIME_ENTRY_AUDIT_MECHANICS.md.
@Entity('time_entry_audits')
export class TimeEntryAudit {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => TimeEntry)
  timeEntry!: TimeEntry;

  @ManyToOne(() => Employee)
  editedBy!: Employee;

  @CreateDateColumn()
  editedAt!: Date;

  @Column({ type: 'int' })
  previousDurationSeconds!: number;

  @Column({ type: 'int' })
  newDurationSeconds!: number;

  @Column({ type: 'varchar', nullable: true })
  reason!: string | null;
}

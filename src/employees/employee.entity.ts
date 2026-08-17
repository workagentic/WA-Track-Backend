import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from '../departments/department.entity';
import { Role } from '../roles/role.entity';
import { Task } from '../tasks/task.entity';
import { TimeEntry } from '../time-entries/time-entry.entity';
import { DeviceSession } from '../device-sessions/device-session.entity';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  fullName!: string;

  @Column()
  email!: string;

  @Column()
  username!: string;

  // Many routes return this entity directly (not through a DTO), including
  // nested inside tasks/time-entries/device-sessions responses — @Exclude()
  // plus the global ClassSerializerInterceptor (main.ts) is what actually
  // keeps this out of every API response.
  @Exclude()
  @Column()
  passwordHash!: string;

  @Column({ default: 'active' })
  status!: string;

  @ManyToOne(() => Department, (d) => d.employees, { nullable: true })
  department!: Department;

  @ManyToOne(() => Role, (r) => r.employees)
  role!: Role;

  // self-referencing manager relation
  @ManyToOne(() => Employee, (e) => e.managedEmployees, { nullable: true })
  @JoinColumn({ name: 'manager_id' }) // Store the foreign key in the manager_id column.
  manager!: Employee;

  @OneToMany(() => Employee, (e) => e.manager)
  managedEmployees!: Employee[];

  @OneToMany(() => TimeEntry, (te) => te.employee)
  timeEntries!: TimeEntry[];

  @OneToMany(() => DeviceSession, (d) => d.employee)
  deviceSessions!: DeviceSession[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;

  @ManyToOne(() => Employee, { nullable: true })
  deletedBy!: Employee | null;
}

import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from '../employees/employee.entity';

@Entity('device_sessions')
export class DeviceSession {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Employee, (e) => e.deviceSessions)
  employee!: Employee;

  @Column()
  deviceFingerprint!: string;

  @Column()
  refreshTokenHash!: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastActive!: Date;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

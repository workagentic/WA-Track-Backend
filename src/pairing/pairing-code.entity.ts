import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from '../employees/employee.entity';

@Entity('pairing_codes')
export class PairingCode {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  deviceCode!: string;

  @Column({ unique: true })
  userCode!: string;

  @ManyToOne(() => Employee, { nullable: true })
  employee!: Employee;

  @Column({ default: 'pending' })
  status!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastPolledAt!: Date;

  @Column({ type: 'int', default: 5 })
  pollIntervalSeconds!: number;

  @Column({ nullable: true })
  deviceSessionId!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

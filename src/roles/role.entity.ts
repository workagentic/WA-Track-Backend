import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Employee } from '../employees/employee.entity';

export enum RoleName {
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
  HR = 'HR',
  ADMIN = 'ADMIN',
}

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  name!: string; // EMPLOYEE | MANAGER | HR | ADMIN

  @Column('simple-array', { nullable: true })
  permissions!: string[];

  @OneToMany(() => Employee, (e) => e.role)
  employees!: Employee[];
}

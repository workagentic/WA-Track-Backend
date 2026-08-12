import { Column, DeleteDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { Task } from '../tasks/task.entity';

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  headEmployeeId: number;

  @OneToMany(() => Employee, (e) => e.department)
  employees: Employee[];

  @OneToMany(() => Task, (t) => t.department)
  tasks: Task[];

  @DeleteDateColumn()
  deletedAt: Date | null;

  @ManyToOne(() => Employee, { nullable: true })
  deletedBy: Employee | null;
}

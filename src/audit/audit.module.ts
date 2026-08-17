import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../employees/employee.entity';
import { Department } from '../departments/department.entity';
import { Client } from '../clients/client.entity';
import { Task } from '../tasks/task.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, Department, Client, Task])],
  providers: [AuditService],
  controllers: [AuditController],
})
export class AuditModule {}

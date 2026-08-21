import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeEntry } from './time-entry.entity';
import { TimeEntryAudit } from './time-entry-audit.entity';
import { Employee } from '../employees/employee.entity';
import { Task } from '../tasks/task.entity';
import { TimeEntriesService } from './time-entries.service';
import { TimeEntriesController } from './time-entries.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TimeEntry, TimeEntryAudit, Employee, Task])],
  providers: [TimeEntriesService],
  controllers: [TimeEntriesController],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeEntry } from '../time-entries/time-entry.entity';
import { Employee } from '../employees/employee.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TimeEntry, Employee])],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}

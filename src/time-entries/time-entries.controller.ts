import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import type { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { TimeEntriesService } from './time-entries.service';
import { SyncTimeEntriesDto } from './dto/sync-time-entries.dto';
import { QueryTimeEntriesDto } from './dto/query-time-entries.dto';
import { CreateManualTimeEntryDto } from './dto/create-manual-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { TimeEntry } from './time-entry.entity';
import { TimeEntryAudit } from './time-entry-audit.entity';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('time-entries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('time-entries')
export class TimeEntriesController {
  constructor(private timeEntriesService: TimeEntriesService) {}

  @Post('sync')
  @ResponseMessage('Time entries synced successfully')
  sync(@Body() dto: SyncTimeEntriesDto, @CurrentUser() user: AuthenticatedUser): Promise<TimeEntry[]> {
    return this.timeEntriesService.sync(dto, user);
  }

  @Get()
  @ResponseMessage('Time entries fetched successfully')
  findAll(
    @Query() query: QueryTimeEntriesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<TimeEntry>> {
    return this.timeEntriesService.findAll(query, user);
  }

  @Post('manual')
  @Roles('HR', 'ADMIN')
  @ResponseMessage('Time entry created successfully')
  createManual(
    @Body() dto: CreateManualTimeEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TimeEntry> {
    return this.timeEntriesService.createManual(dto, user);
  }

  @Patch(':id')
  @Roles('HR', 'ADMIN')
  @ResponseMessage('Time entry updated successfully')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTimeEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TimeEntry> {
    return this.timeEntriesService.update(id, dto, user);
  }

  @Get(':id/audit')
  @Roles('HR', 'ADMIN')
  @ResponseMessage('Time entry edit history fetched successfully')
  getAuditHistory(@Param('id', ParseIntPipe) id: number): Promise<TimeEntryAudit[]> {
    return this.timeEntriesService.getAuditHistory(id);
  }
}

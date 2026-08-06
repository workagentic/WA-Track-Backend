import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TimeEntriesService } from './time-entries.service';
import { SyncTimeEntriesDto } from './dto/sync-time-entries.dto';
import { QueryTimeEntriesDto } from './dto/query-time-entries.dto';
import { TimeEntry } from './time-entry.entity';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('time-entries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('time-entries')
export class TimeEntriesController {
  constructor(private timeEntriesService: TimeEntriesService) {}

  @Post('sync')
  sync(@Body() dto: SyncTimeEntriesDto, @CurrentUser() user: AuthenticatedUser): Promise<TimeEntry[]> {
    return this.timeEntriesService.sync(dto, user);
  }

  @Get()
  findAll(@Query() query: QueryTimeEntriesDto, @CurrentUser() user: AuthenticatedUser): Promise<TimeEntry[]> {
    return this.timeEntriesService.findAll(query, user);
  }
}

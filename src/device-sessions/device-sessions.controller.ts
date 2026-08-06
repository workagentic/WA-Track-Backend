import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { DeviceSessionsService } from './device-sessions.service';
import { DeviceSession } from './device-session.entity';

@ApiTags('device-sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('device-sessions')
export class DeviceSessionsController {
  constructor(private deviceSessionsService: DeviceSessionsService) {}

  @Get()
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<DeviceSession[]> {
    return this.deviceSessionsService.findMine(user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.deviceSessionsService.revoke(id, user);
  }
}

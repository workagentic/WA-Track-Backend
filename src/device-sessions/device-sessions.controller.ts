import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResult } from '../common/interfaces/paginated-result.interface';
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
  @ResponseMessage('Device sessions fetched successfully')
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<DeviceSession>> {
    return this.deviceSessionsService.findMine(user, query.page, query.limit);
  }

  // 204 carries no body, so no ResponseMessage applies here — the
  // ResponseInterceptor skips wrapping entirely for HttpStatus.NO_CONTENT.
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.deviceSessionsService.revoke(id, user);
  }
}

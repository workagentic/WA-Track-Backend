import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import type { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import type { AuditEntityType, AuditEntry } from './interfaces/audit-entry.interface';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('HR', 'ADMIN')
@Controller('audit')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('deletions')
  @ResponseMessage('Deletion audit log fetched successfully')
  public findDeletions(@Query() query: QueryAuditDto): Promise<PaginatedResult<AuditEntry>> {
    return this.auditService.findDeletions(query);
  }

  @Get('deletions/:entityType/:id')
  @ResponseMessage('Deletion record fetched successfully')
  public findOne(
    @Param('entityType') entityType: AuditEntityType,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AuditEntry> {
    return this.auditService.findOne(entityType, id);
  }
}

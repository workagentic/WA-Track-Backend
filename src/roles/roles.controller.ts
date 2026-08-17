import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { RolesService } from './roles.service';
import { Role } from './role.entity';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('roles')
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get()
  @ResponseMessage('Roles fetched successfully')
  findAll(@Query() query: PaginationQueryDto): Promise<PaginatedResult<Role>> {
    return this.rolesService.findAll(query.page, query.limit);
  }
}

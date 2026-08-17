import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import type { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { QueryDepartmentsDto } from './dto/query-departments.dto';
import { Department } from './department.entity';

@ApiTags('departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @Get()
  @ResponseMessage('Departments fetched successfully')
  findAll(@Query() query: QueryDepartmentsDto): Promise<PaginatedResult<Department>> {
    return this.departmentsService.findAll(query.page, query.limit, query.withDeleted === 'true');
  }

  @Post()
  @Roles('HR', 'ADMIN')
  @ResponseMessage('Department created successfully')
  create(@Body() dto: CreateDepartmentDto): Promise<Department> {
    return this.departmentsService.create(dto);
  }

  @Patch(':id')
  @Roles('HR', 'ADMIN')
  @ResponseMessage('Department updated successfully')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<Department> {
    return this.departmentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('HR', 'ADMIN')
  @ResponseMessage('Department deleted successfully')
  public async softDelete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Query('force') force?: string,
  ): Promise<void> {
    await this.departmentsService.softDelete(id, user.sub, force === 'true');
  }

  @Patch(':id/restore')
  @Roles('HR', 'ADMIN')
  @ResponseMessage('Department restored successfully')
  public restore(@Param('id', ParseIntPipe) id: number): Promise<Department> {
    return this.departmentsService.restore(id);
  }
}

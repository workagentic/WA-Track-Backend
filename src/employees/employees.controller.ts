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
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Employee } from './employee.entity';

@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  @Get()
  @ResponseMessage('Employees fetched successfully')
  public findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<Employee>> {
    return this.employeesService.findAll(user, query.page, query.limit);
  }

  @Post()
  @Roles('HR', 'ADMIN')
  @ResponseMessage('Employee created successfully')
  public create(@Body() dto: CreateEmployeeDto): Promise<Employee> {
    return this.employeesService.create(dto);
  }

  @Patch(':id')
  @Roles('HR', 'ADMIN')
  @ResponseMessage('Employee updated successfully')
  public update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmployeeDto): Promise<Employee> {
    return this.employeesService.update(id, dto);
  }

  @Patch(':id/password')
  @Roles('HR', 'ADMIN')
  @ResponseMessage('Password changed successfully')
  public async changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.employeesService.changePassword(id, dto.password);
  }

  @Delete(':id')
  @Roles('HR', 'ADMIN')
  @ResponseMessage('Employee deleted successfully')
  public async softDelete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.employeesService.softDelete(id, user.sub);
  }

  @Patch(':id/restore')
  @Roles('HR', 'ADMIN')
  @ResponseMessage('Employee restored successfully')
  public restore(@Param('id', ParseIntPipe) id: number): Promise<Employee> {
    return this.employeesService.restore(id);
  }
}

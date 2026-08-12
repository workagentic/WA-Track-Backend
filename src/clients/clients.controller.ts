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
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { Client } from './client.entity';

@ApiTags('clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  @ResponseMessage('Clients fetched successfully')
  public findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryClientsDto,
  ): Promise<PaginatedResult<Client>> {
    return this.clientsService.findAll(user, query.withDeleted === 'true', query.page, query.limit);
  }

  @Get(':id')
  @ResponseMessage('Client fetched successfully')
  public findById(@Param('id', ParseIntPipe) id: number): Promise<Client> {
    return this.clientsService.findById(id);
  }

  @Post()
  @Roles('HR', 'MANAGER', 'ADMIN')
  @ResponseMessage('Client created successfully')
  public create(@Body() dto: CreateClientDto, @CurrentUser() user: AuthenticatedUser): Promise<Client> {
    return this.clientsService.create(dto, user);
  }

  @Patch(':id')
  @Roles('HR', 'MANAGER', 'ADMIN')
  @ResponseMessage('Client updated successfully')
  public update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Client> {
    return this.clientsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('HR', 'ADMIN')
  @ResponseMessage('Client deleted successfully')
  public async softDelete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Query('force') force?: string,
  ): Promise<void> {
    await this.clientsService.softDelete(id, user.sub, force === 'true');
  }

  @Patch(':id/restore')
  @Roles('HR', 'ADMIN')
  @ResponseMessage('Client restored successfully')
  public restore(@Param('id', ParseIntPipe) id: number): Promise<Client> {
    return this.clientsService.restore(id);
  }
}

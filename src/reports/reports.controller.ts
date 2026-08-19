import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { ExportReportQueryDto } from './dto/export-report-query.dto';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('export')
  @Roles('HR', 'ADMIN')
  @ApiOperation({ summary: 'Streams a single .xlsx with an hours tab and a decimal tab for the given filters' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async export(@Query() query: ExportReportQueryDto, @Res() res: Response): Promise<void> {
    const workbook = await this.reportsService.buildExportWorkbook(query);
    const rangeLabel = `${query.from ?? 'all'} to ${query.to ?? 'all'}`;
    const filename = `WA Track Report ${rangeLabel}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  }
}

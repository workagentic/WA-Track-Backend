import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsInt, IsOptional } from 'class-validator';
import { DEFAULT_REPORT_FORMAT, REPORT_FORMATS } from '../constant/report-format.constant';
import type { ReportFormat } from '../constant/report-format.constant';

export class ExportReportQueryDto {
  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departmentId?: number;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Restrict the report to specific employees (comma-separated ids, e.g. "12,15,18"). Omit for all employees.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map(Number)
      : String(value)
          .split(',')
          .map((v: string) => v.trim())
          .filter((v: string) => v.length > 0)
          .map(Number),
  )
  @IsArray()
  @IsInt({ each: true })
  employeeIds?: number[];

  @ApiPropertyOptional({ enum: REPORT_FORMATS, default: DEFAULT_REPORT_FORMAT })
  @IsOptional()
  @IsIn(REPORT_FORMATS)
  format?: ReportFormat;
}

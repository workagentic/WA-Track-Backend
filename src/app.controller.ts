import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AppService } from './app.service';
import type { HealthStatus } from './app.service';
import { ResponseMessage } from './common/decorators/response-message.decorator';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ResponseMessage('Health check successful')
  getHealth(@Req() req: Request): HealthStatus {
    return this.appService.getHealth(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
  }
}

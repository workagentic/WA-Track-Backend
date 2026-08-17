import { Injectable } from '@nestjs/common';

export interface HealthStatus {
  status: string;
  message: string;
  time: string;
  url: string;
}

@Injectable()
export class AppService {
  public getHealth(url: string): HealthStatus {
    return {
      status: 'ok',
      message: 'Service is healthy',
      time: new Date().toISOString(),
      url,
    };
  }
}

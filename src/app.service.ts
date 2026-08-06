import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  public getHealth(): { status: string } {
    return { status: 'ok' };
  }
}

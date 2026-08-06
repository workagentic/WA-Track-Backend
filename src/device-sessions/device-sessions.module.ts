import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceSession } from './device-session.entity';
import { DeviceSessionsService } from './device-sessions.service';
import { DeviceSessionsController } from './device-sessions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceSession])],
  providers: [DeviceSessionsService],
  controllers: [DeviceSessionsController],
  exports: [DeviceSessionsService],
})
export class DeviceSessionsModule {}

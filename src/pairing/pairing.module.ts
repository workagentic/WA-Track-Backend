import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PairingCode } from './pairing-code.entity';
import { Employee } from '../employees/employee.entity';
import { DeviceSession } from '../device-sessions/device-session.entity';
import { AuthModule } from '../auth/auth.module';
import { PairingService } from './pairing.service';
import { PairingController } from './pairing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PairingCode, Employee, DeviceSession]), AuthModule],
  providers: [PairingService],
  controllers: [PairingController],
})
export class PairingModule {}

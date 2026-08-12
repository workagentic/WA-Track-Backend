import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { DeviceSession } from '../../device-sessions/device-session.entity';
import { Employee } from '../../employees/employee.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(DeviceSession) private deviceSessionsRepo: Repository<DeviceSession>,
    @InjectRepository(Employee) private employeesRepo: Repository<Employee>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  // Re-checked on every request (not just at login) so HR locking an employee
  // out from the dashboard takes effect immediately, even against an access
  // token issued before the lockout. findOne() also excludes soft-deleted
  // employees automatically, so an offboarded employee is cut off the same way.
  public async validate(payload: AuthenticatedUser): Promise<AuthenticatedUser> {
    const employee = await this.employeesRepo.findOne({ where: { id: payload.sub } });
    if (!employee || employee.status !== 'active') {
      throw new UnauthorizedException('Your account has been locked. Contact your administrator.');
    }

    if (payload.deviceSessionId !== undefined) {
      const session = await this.deviceSessionsRepo.findOne({ where: { id: payload.deviceSessionId } });
      if (!session || !session.isActive) {
        throw new UnauthorizedException('Device session has been revoked');
      }
    }

    return payload;
  }
}

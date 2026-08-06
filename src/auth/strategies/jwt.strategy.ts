import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { DeviceSession } from '../../device-sessions/device-session.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(DeviceSession) private deviceSessionsRepo: Repository<DeviceSession>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  public async validate(payload: AuthenticatedUser): Promise<AuthenticatedUser> {
    if (payload.deviceSessionId !== undefined) {
      const session = await this.deviceSessionsRepo.findOne({ where: { id: payload.deviceSessionId } });
      if (!session || !session.isActive) {
        throw new UnauthorizedException('Device session has been revoked');
      }
    }

    return payload;
  }
}

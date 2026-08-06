import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { DeviceSession } from '../device-sessions/device-session.entity';
import { RefreshTokenPayload } from './interfaces/refresh-token-payload.interface';
import { LoginDto } from './dto/login.dto';
import { AuthTokensDto } from './dto/auth-tokens.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Employee) private employeesRepo: Repository<Employee>,
    @InjectRepository(DeviceSession) private deviceSessionsRepo: Repository<DeviceSession>,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  public async validateCredentials(email: string, password: string): Promise<Employee> {
    const employee = await this.employeesRepo.findOne({
      where: { email },
      relations: { role: true, department: true },
    });
    if (!employee || employee.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await bcrypt.compare(password, employee.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return employee;
  }

  private buildAccessToken(employee: Employee, deviceSessionId?: number): string {
    const payload = {
      sub: employee.id,
      email: employee.email,
      fullName: employee.fullName,
      role: employee.role?.name,
      departmentId: employee.department?.id ?? null,
      ...(deviceSessionId !== undefined ? { deviceSessionId } : {}),
    };

    return this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as JwtSignOptions['expiresIn'],
    });
  }

  private buildRefreshToken(payload: RefreshTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as JwtSignOptions['expiresIn'],
    });
  }

  /** Web portal login: no device session is involved, so tokens carry a 'web' session type. */
  public async login(dto: LoginDto): Promise<AuthTokensDto> {
    const employee = await this.validateCredentials(dto.email, dto.password);

    const accessToken = this.buildAccessToken(employee);
    const refreshToken = this.buildRefreshToken({
      sub: employee.id,
      role: employee.role?.name,
      departmentId: employee.department?.id ?? null,
      sessionType: 'web',
    });

    return { accessToken, refreshToken };
  }

  /** Desktop app login: tokens are tied to a device session so they can be individually revoked. */
  public async issueDeviceTokens(employee: Employee, deviceSession: DeviceSession): Promise<AuthTokensDto> {
    const accessToken = this.buildAccessToken(employee, deviceSession.id);
    const refreshToken = this.buildRefreshToken({
      sub: employee.id,
      role: employee.role?.name,
      departmentId: employee.department?.id ?? null,
      sessionType: 'device',
      deviceSessionId: deviceSession.id,
    });

    deviceSession.refreshTokenHash = this.hashToken(refreshToken);
    deviceSession.lastActive = new Date();
    await this.deviceSessionsRepo.save(deviceSession);

    return { accessToken, refreshToken };
  }

  public async refresh(payload: RefreshTokenPayload & { raw: string }): Promise<AuthTokensDto> {
    const employee = await this.employeesRepo.findOne({
      where: { id: payload.sub },
      relations: { role: true, department: true },
    });
    if (!employee || employee.status !== 'active') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    let deviceSession: DeviceSession | null = null;
    if (payload.sessionType === 'device') {
      deviceSession = await this.deviceSessionsRepo.findOne({
        where: { id: payload.deviceSessionId },
      });

      const presentedHash = this.hashToken(payload.raw);
      if (!deviceSession || !deviceSession.isActive || deviceSession.refreshTokenHash !== presentedHash) {
        throw new UnauthorizedException('Device session has been revoked');
      }
    }

    const accessToken = this.buildAccessToken(employee, deviceSession?.id);
    const refreshToken = this.buildRefreshToken({
      sub: employee.id,
      role: employee.role?.name,
      departmentId: employee.department?.id ?? null,
      sessionType: payload.sessionType,
      deviceSessionId: deviceSession?.id,
    });

    if (deviceSession) {
      deviceSession.refreshTokenHash = this.hashToken(refreshToken);
      deviceSession.lastActive = new Date();
      await this.deviceSessionsRepo.save(deviceSession);
    }

    return { accessToken, refreshToken };
  }
}

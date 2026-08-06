import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { PairingCode } from './pairing-code.entity';
import { Employee } from '../employees/employee.entity';
import { DeviceSession } from '../device-sessions/device-session.entity';
import { AuthService } from '../auth/auth.service';
import { AuthorizationPendingException, PairingExpiredException, SlowDownException } from './pairing.exceptions';
import { PairingDeviceCodeResponseDto } from './dto/device-code-response.dto';
import { PairingTokenResponseDto } from './dto/pairing-token-response.dto';

const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class PairingService {
  constructor(
    @InjectRepository(PairingCode) private pairingCodesRepo: Repository<PairingCode>,
    @InjectRepository(Employee) private employeesRepo: Repository<Employee>,
    @InjectRepository(DeviceSession) private deviceSessionsRepo: Repository<DeviceSession>,
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  private randomUserCode(): string {
    const part = () =>
      Array.from({ length: 4 }, () => USER_CODE_ALPHABET[crypto.randomInt(USER_CODE_ALPHABET.length)]).join('');
    return `${part()}-${part()}`;
  }

  async createDeviceCode(): Promise<PairingDeviceCodeResponseDto> {
    const ttlMinutes = this.config.get('PAIRING_CODE_TTL_MINUTES', 10);
    const pollIntervalSeconds = this.config.get('PAIRING_POLL_INTERVAL_SECONDS', 5);

    let userCode = this.randomUserCode();
    while (await this.pairingCodesRepo.findOne({ where: { userCode } })) {
      userCode = this.randomUserCode();
    }

    const pairingCode = this.pairingCodesRepo.create({
      deviceCode: crypto.randomBytes(32).toString('hex'),
      userCode,
      status: 'pending',
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      pollIntervalSeconds,
    });
    await this.pairingCodesRepo.save(pairingCode);

    return {
      userCode: pairingCode.userCode,
      deviceCode: pairingCode.deviceCode,
      expiresAt: pairingCode.expiresAt,
      pollIntervalSeconds: pairingCode.pollIntervalSeconds,
    };
  }

  async confirm(userCode: string, employeeId: number): Promise<void> {
    const pairingCode = await this.pairingCodesRepo.findOne({ where: { userCode } });
    if (!pairingCode) {
      throw new NotFoundException('Unknown or already-used pairing code');
    }

    if (pairingCode.status === 'expired' || pairingCode.expiresAt < new Date()) {
      pairingCode.status = 'expired';
      await this.pairingCodesRepo.save(pairingCode);
      throw new PairingExpiredException();
    }

    if (pairingCode.status !== 'pending') {
      throw new ConflictException('This code has already been confirmed');
    }

    pairingCode.status = 'confirmed';
    pairingCode.employee = { id: employeeId } as Employee;
    await this.pairingCodesRepo.save(pairingCode);
  }

  async poll(deviceCode: string): Promise<PairingTokenResponseDto> {
    const pairingCode = await this.pairingCodesRepo.findOne({
      where: { deviceCode },
      relations: { employee: { role: true, department: true } },
    });
    if (!pairingCode) {
      throw new NotFoundException('Unknown device code');
    }

    const now = new Date();

    if (pairingCode.expiresAt < now) {
      if (pairingCode.status !== 'expired') {
        pairingCode.status = 'expired';
        await this.pairingCodesRepo.save(pairingCode);
      }
      throw new PairingExpiredException();
    }

    if (pairingCode.status === 'expired') {
      if (pairingCode.deviceSessionId && pairingCode.employee) {
        return this.issueTokensForRetry(pairingCode.employee, deviceCode);
      }
      throw new PairingExpiredException();
    }

    if (pairingCode.lastPolledAt) {
      const earliestNextPoll = pairingCode.lastPolledAt.getTime() + pairingCode.pollIntervalSeconds * 1000;
      if (now.getTime() < earliestNextPoll) {
        pairingCode.pollIntervalSeconds = pairingCode.pollIntervalSeconds * 2;
        await this.pairingCodesRepo.save(pairingCode);
        throw new SlowDownException(pairingCode.pollIntervalSeconds);
      }
    }

    pairingCode.lastPolledAt = now;

    if (pairingCode.status === 'pending') {
      await this.pairingCodesRepo.save(pairingCode);
      throw new AuthorizationPendingException(pairingCode.pollIntervalSeconds);
    }

    const employee = pairingCode.employee;
    if (!employee) {
      throw new NotFoundException('Pairing code has no linked employee');
    }

    const { tokens, deviceSessionId } = await this.issueDeviceTokens(employee, pairingCode.deviceCode);
    pairingCode.status = 'expired';
    pairingCode.deviceSessionId = deviceSessionId;
    await this.pairingCodesRepo.save(pairingCode);

    return { ...tokens, deviceSessionId };
  }

  private async issueDeviceTokens(employee: Employee, deviceFingerprint: string) {
    const deviceSession = this.deviceSessionsRepo.create({
      employee,
      deviceFingerprint,
      refreshTokenHash: '',
      isActive: true,
      lastActive: new Date(),
    });
    await this.deviceSessionsRepo.save(deviceSession);

    const tokens = await this.authService.issueDeviceTokens(employee, deviceSession);
    return { tokens, deviceSessionId: deviceSession.id };
  }

  private async issueTokensForRetry(employee: Employee, deviceFingerprint: string): Promise<PairingTokenResponseDto> {
    const { tokens, deviceSessionId } = await this.issueDeviceTokens(employee, deviceFingerprint);
    return { ...tokens, deviceSessionId };
  }
}

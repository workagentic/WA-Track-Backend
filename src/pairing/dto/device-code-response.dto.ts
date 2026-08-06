import { ApiProperty } from '@nestjs/swagger';

export class PairingDeviceCodeResponseDto {
  @ApiProperty({ example: 'K7QM-2F9X' })
  userCode!: string;

  @ApiProperty()
  deviceCode!: string;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  pollIntervalSeconds!: number;
}

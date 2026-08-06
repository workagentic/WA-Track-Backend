import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ConfirmPairingDto {
  @ApiProperty({ example: 'K7QM-2F9X' })
  @IsString()
  @Matches(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/, { message: 'userCode must match XXXX-XXXX format' })
  userCode!: string;
}

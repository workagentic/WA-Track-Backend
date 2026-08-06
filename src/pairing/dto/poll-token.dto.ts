import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PollTokenDto {
  @ApiProperty()
  @IsString()
  deviceCode!: string;
}

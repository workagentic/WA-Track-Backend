import { ApiProperty } from '@nestjs/swagger';
import { AuthTokensDto } from '../../auth/dto/auth-tokens.dto';

export class PairingTokenResponseDto extends AuthTokensDto {
  @ApiProperty()
  deviceSessionId!: number;
}

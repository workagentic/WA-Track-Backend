import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class AssignClientDto {
  @ApiProperty()
  @IsInt()
  clientId: number;
}

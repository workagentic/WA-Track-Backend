import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateClientDto } from './create-client.dto';

// department is fixed at creation — a client doesn't move departments after the fact
export class UpdateClientDto extends PartialType(OmitType(CreateClientDto, ['departmentId'] as const)) {}

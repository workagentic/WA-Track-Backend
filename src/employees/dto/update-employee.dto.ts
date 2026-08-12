import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateEmployeeDto } from './create-employee.dto';

// password changes go through a dedicated /employees/:id/password endpoint;
// username is immutable once set — neither is ever accepted on a plain PATCH.
export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['password', 'username'] as const),
) {}

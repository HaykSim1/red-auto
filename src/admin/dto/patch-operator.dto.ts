import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateOperatorDto } from './create-operator.dto';

/** Email is the login and stays fixed; `password`, when present, resets the password. */
export class PatchOperatorDto extends PartialType(
  OmitType(CreateOperatorDto, ['email'] as const),
) {}

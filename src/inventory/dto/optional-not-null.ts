import { ValidateIf } from 'class-validator';

/** Optional, but unlike @IsOptional() an explicit null is validated (and rejected). */
export const OptionalNotNull = () =>
  ValidateIf((_o, value) => value !== undefined);

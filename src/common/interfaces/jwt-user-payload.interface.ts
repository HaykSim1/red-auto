import { UserRole } from '../../database/enums';

export interface JwtUserPayload {
  sub: string;
  role: UserRole;
  phone_verified: boolean;
}

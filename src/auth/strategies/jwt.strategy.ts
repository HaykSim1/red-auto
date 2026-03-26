import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '../../database/enums';
import type { JwtUserPayload } from '../../common/interfaces/jwt-user-payload.interface';

interface JwtPayloadShape {
  sub: string;
  role: UserRole;
  phone_verified: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayloadShape): JwtUserPayload {
    return {
      sub: payload.sub,
      role: payload.role,
      phone_verified: payload.phone_verified,
    };
  }
}

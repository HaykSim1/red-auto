import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/enums';
import type { JwtUserPayload } from '../../common/interfaces/jwt-user-payload.interface';

interface JwtPayloadShape {
  sub: string;
  role: UserRole;
  phone_verified: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayloadShape): Promise<JwtUserPayload> {
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user || user.blockedAt) {
      throw new UnauthorizedException();
    }
    return {
      sub: user.id,
      role: user.role ?? UserRole.USER,
      phone_verified: true,
    };
  }
}

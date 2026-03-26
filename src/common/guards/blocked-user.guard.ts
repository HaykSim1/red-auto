import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ApiException } from '../exceptions/api.exception';
import type { JwtUserPayload } from '../interfaces/jwt-user-payload.interface';

@Injectable()
export class BlockedUserGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{ user?: JwtUserPayload }>();
    const userId = req.user?.sub;
    if (!userId) return true;

    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, blockedAt: true },
    });
    if (user?.blockedAt) {
      throw new ApiException(
        'user_blocked',
        'User is blocked.',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt } from 'crypto';
import { IsNull, LessThan, Repository } from 'typeorm';
import { ApiException } from '../common/exceptions/api.exception';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { OtpSession } from '../database/entities/otp-session.entity';
import { RefreshSession } from '../database/entities/refresh-session.entity';
import { User } from '../database/entities/user.entity';
import { UserRole } from '../database/enums';
import { SMS_SENDER, type SmsSender } from './sms-sender.interface';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 8;
const BCRYPT_ROUNDS = 10;

function randomOtp(): string {
  return String(randomInt(100000, 1000000));
}

/** Parse a duration string like "15m", "30d", "1h" into a future Date. */
function parseExpiryToDate(expiry: string): Date {
  const match = /^(\d+)([smhd])$/.exec(expiry.trim());
  if (!match) throw new Error(`Invalid expiry format: ${expiry}`);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return new Date(Date.now() + value * multipliers[unit]);
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(OtpSession)
    private readonly otpSessions: Repository<OtpSession>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(RefreshSession)
    private readonly refreshSessions: Repository<RefreshSession>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  async requestOtp(phone: string, _otpDevMode: boolean): Promise<void> {
    await this.otpSessions.delete({ phone });
    void this.cleanupExpired();

    const code = randomOtp();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.otpSessions.save(
      this.otpSessions.create({
        phone,
        codeHash,
        expiresAt,
        attemptCount: 0,
      }),
    );

    await this.sms.sendOtp(phone, code);
  }

  private async cleanupExpired(): Promise<void> {
    await this.otpSessions.delete({ expiresAt: LessThan(new Date()) });
  }

  async verifyOtp(
    phone: string,
    code: string,
  ): Promise<{
    access_token: string;
    refresh_token: string;
    user: ReturnType<AuthService['userSummary']>;
  }> {
    const session = await this.otpSessions.findOne({
      where: { phone },
      order: { createdAt: 'DESC' },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new ApiException(
        'otp_invalid',
        'Invalid or expired code.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (session.attemptCount >= MAX_OTP_ATTEMPTS) {
      throw new ApiException(
        'otp_locked',
        'Too many attempts. Request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const ok = await bcrypt.compare(code, session.codeHash);
    if (!ok) {
      session.attemptCount += 1;
      await this.otpSessions.save(session);
      throw new ApiException(
        'otp_invalid',
        'Invalid or expired code.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.otpSessions.delete({ id: session.id });

    let user = await this.users.findOne({ where: { phone } });
    if (!user) {
      user = await this.users.save(
        this.users.create({
          phone,
          role: UserRole.USER,
        }),
      );
    }

    // Dev admin phone: first OTP created them as USER before seed ran; promote when allowed.
    const adminPhone = (
      this.config.get<string>('SEED_ADMIN_PHONE') ?? '+37400000000'
    ).trim();
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';
    const localAdminOtp =
      this.config.get<boolean>('LOCAL_ADMIN_OTP') === true ||
      this.config.get<boolean>('ADMIN_OTP_BOOTSTRAP') === true;
    const allowAdminPromote = nodeEnv !== 'production' || localAdminOtp;
    const phonesMatchSeed = user.phone.trim() === adminPhone;
    if (allowAdminPromote && phonesMatchSeed && user.role === UserRole.USER) {
      user.role = UserRole.ADMIN;
      user = await this.users.save(user);
    }

    if (user.blockedAt) {
      throw new ApiException(
        'user_blocked',
        'User is blocked.',
        HttpStatus.FORBIDDEN,
      );
    }

    const resolvedRole = user.role ?? UserRole.USER;
    const payload: JwtUserPayload = {
      sub: user.id,
      role: resolvedRole,
      phone_verified: true,
    };

    const access_token = await this.jwt.signAsync({
      sub: payload.sub,
      role: payload.role,
      phone_verified: payload.phone_verified,
    });

    const refresh_token = await this.issueRefreshToken(user.id);

    return {
      access_token,
      refresh_token,
      user: this.userSummary(user),
    };
  }

  /** Issue a new refresh token for the given user and persist the session. */
  private async issueRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(raw, BCRYPT_ROUNDS);
    const expiresInStr =
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d';
    const expiresAt = parseExpiryToDate(expiresInStr);

    const user = this.users.create({ id: userId } as User);
    await this.refreshSessions.save(
      this.refreshSessions.create({ user, tokenHash, expiresAt, revokedAt: null }),
    );
    return raw;
  }

  /** Validate a raw refresh token and return a new access + refresh token pair (rotation). */
  async refreshTokens(
    rawToken: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    // Find active session by scanning non-revoked, non-expired rows for this token.
    // bcrypt compare is needed because hash is non-deterministic; we load recent sessions.
    const candidates = await this.refreshSessions.find({
      where: { revokedAt: IsNull() },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: 500,
    });

    let session: RefreshSession | null = null;
    for (const c of candidates) {
      if (c.expiresAt < new Date()) continue;
      const match = await bcrypt.compare(rawToken, c.tokenHash);
      if (match) {
        session = c;
        break;
      }
    }

    if (!session) {
      throw new ApiException('unauthorized', 'Invalid or expired refresh token.', HttpStatus.UNAUTHORIZED);
    }

    const user = session.user;
    if (user.blockedAt) {
      throw new ApiException('user_blocked', 'User is blocked.', HttpStatus.FORBIDDEN);
    }

    // Rotate: revoke old session
    session.revokedAt = new Date();
    await this.refreshSessions.save(session);

    // Issue new pair
    const resolvedRole = user.role ?? UserRole.USER;
    const access_token = await this.jwt.signAsync({
      sub: user.id,
      role: resolvedRole,
      phone_verified: true,
    });
    const refresh_token = await this.issueRefreshToken(user.id);

    return { access_token, refresh_token };
  }

  /** Revoke a refresh token (idempotent — silently succeeds if not found). */
  async revokeRefreshToken(rawToken: string): Promise<void> {
    const candidates = await this.refreshSessions.find({
      where: { revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
      take: 500,
    });

    for (const c of candidates) {
      const match = await bcrypt.compare(rawToken, c.tokenHash);
      if (match) {
        c.revokedAt = new Date();
        await this.refreshSessions.save(c);
        return;
      }
    }
  }

  /** Re-issue JWT from DB (e.g. after role change) without OTP. */
  async refreshAccessToken(userId: string): Promise<{ access_token: string }> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new ApiException('not_found', 'User not found.', HttpStatus.NOT_FOUND);
    }
    if (user.blockedAt) {
      throw new ApiException(
        'user_blocked',
        'User is blocked.',
        HttpStatus.FORBIDDEN,
      );
    }
    const resolvedRole = user.role ?? UserRole.USER;
    const access_token = await this.jwt.signAsync({
      sub: user.id,
      role: resolvedRole,
      phone_verified: true,
    });
    return { access_token };
  }

  userSummary(user: User) {
    const role = user.role ?? UserRole.USER;
    return {
      id: user.id,
      phone: user.phone,
      role,
      display_name: user.displayName,
      preferred_locale: user.preferredLocale,
    };
  }
}

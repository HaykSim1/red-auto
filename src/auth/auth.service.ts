import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { LessThan, Repository } from 'typeorm';
import { ApiException } from '../common/exceptions/api.exception';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { OtpSession } from '../database/entities/otp-session.entity';
import { User } from '../database/entities/user.entity';
import { UserRole } from '../database/enums';
import { SMS_SENDER, type SmsSender } from './sms-sender.interface';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 8;
const BCRYPT_ROUNDS = 10;

function randomOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(OtpSession)
    private readonly otpSessions: Repository<OtpSession>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  async requestOtp(phone: string, _otpDevMode: boolean): Promise<void> {
    await this.otpSessions.delete({ phone });
    await this.cleanupExpired();

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
  ): Promise<{ access_token: string; user: ReturnType<AuthService['userSummary']> }> {
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
    const allowAdminPromote =
      nodeEnv !== 'production' || localAdminOtp;
    if (
      allowAdminPromote &&
      user.phone.trim() === adminPhone &&
      user.role === UserRole.USER
    ) {
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

    const payload: JwtUserPayload = {
      sub: user.id,
      role: user.role,
      phone_verified: true,
    };

    const access_token = await this.jwt.signAsync({
      sub: payload.sub,
      role: payload.role,
      phone_verified: payload.phone_verified,
    });

    return {
      access_token,
      user: this.userSummary(user),
    };
  }

  userSummary(user: User) {
    return {
      id: user.id,
      phone: user.phone,
      role: user.role,
      display_name: user.displayName,
      preferred_locale: user.preferredLocale,
    };
  }
}

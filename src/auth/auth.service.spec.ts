import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { OtpSession } from '../database/entities/otp-session.entity';
import { RefreshSession } from '../database/entities/refresh-session.entity';
import { User } from '../database/entities/user.entity';
import { UserRole } from '../database/enums';
import { AuthService } from './auth.service';
import { SMS_SENDER } from './sms-sender.interface';

describe('AuthService — managed shop personas cannot sign in', () => {
  let service: AuthService;
  let otpRepo: { findOne: jest.Mock; delete: jest.Mock; save: jest.Mock };
  let usersRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };

  const persona = {
    id: 'persona-1',
    phone: '+37491000777',
    role: UserRole.SELLER,
    isManagedShop: true,
    blockedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(OtpSession),
          useValue: { findOne: jest.fn(), delete: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn() },
        },
        {
          provide: getRepositoryToken(RefreshSession),
          useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn() },
        },
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: SMS_SENDER, useValue: { sendOtp: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
    otpRepo = module.get(getRepositoryToken(OtpSession));
    usersRepo = module.get(getRepositoryToken(User));
  });

  it('verifyOtp rejects a managed shop with managed_shop_no_login', async () => {
    otpRepo.findOne.mockResolvedValue({
      id: 'otp-1',
      phone: persona.phone,
      codeHash: await bcrypt.hash('123456', 4),
      expiresAt: new Date(Date.now() + 60_000),
      attemptCount: 0,
    });
    usersRepo.findOne.mockResolvedValue(persona);

    await expect(
      service.verifyOtp(persona.phone, '123456'),
    ).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      code: 'managed_shop_no_login',
    });
  });

  it('refreshAccessToken rejects a managed shop with managed_shop_no_login', async () => {
    usersRepo.findOne.mockResolvedValue(persona);

    await expect(service.refreshAccessToken(persona.id)).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      code: 'managed_shop_no_login',
    });
  });
});

import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthOtpVerifyResponseDto,
  AuthRefreshResponseDto,
} from '../common/dto/responses.dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LogoutDto } from './dto/logout.dto';
import { OtpRequestDto } from './dto/otp-request.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('otp/request')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send OTP to phone' })
  async requestOtp(@Body() dto: OtpRequestDto): Promise<{ ok: true }> {
    const otpDevMode = this.config.get<boolean>('OTP_DEV_MODE') === true;
    await this.auth.requestOtp(dto.phone.trim(), otpDevMode);
    return { ok: true };
  }

  @Public()
  @Post('otp/verify')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify OTP and receive access + refresh token pair' })
  @ApiCreatedResponse({ type: AuthOtpVerifyResponseDto })
  verify(@Body() dto: OtpVerifyDto) {
    return this.auth.verifyOtp(dto.phone.trim(), dto.code.trim());
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Exchange refresh token for a new access + refresh token pair' })
  @ApiOkResponse({ type: AuthRefreshResponseDto })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refreshTokens(dto.refresh_token);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke refresh token (server-side logout)' })
  @ApiNoContentResponse({ description: 'Token revoked' })
  async logout(@Body() dto: LogoutDto): Promise<void> {
    await this.auth.revokeRefreshToken(dto.refresh_token);
  }
}

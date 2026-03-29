import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthOtpVerifyResponseDto } from '../common/dto/responses.dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { OtpRequestDto } from './dto/otp-request.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';

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
  @ApiOperation({ summary: 'Verify OTP and receive JWT' })
  @ApiCreatedResponse({ type: AuthOtpVerifyResponseDto })
  verify(@Body() dto: OtpVerifyDto) {
    return this.auth.verifyOtp(dto.phone.trim(), dto.code.trim());
  }
}

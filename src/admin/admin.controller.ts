import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { SellerApplicationStatus, UserRole } from '../database/enums';
import { RejectSellerApplicationDto } from '../seller-applications/dto/reject-seller-application.dto';
import { AuthOtpVerifyResponseDto } from '../common/dto/responses.dto';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { PatchModerationDto } from './dto/patch-moderation.dto';
import { PushTestDto } from './dto/push-test.dto';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Public()
  @Roles()
  @Post('auth/login')
  @ApiOperation({ summary: 'Admin email + password login' })
  @ApiCreatedResponse({ type: AuthOtpVerifyResponseDto })
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.admin.adminLogin(dto.email, dto.password);
  }

  @Get('users')
  @ApiOperation({ summary: 'List users' })
  listUsers(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.admin.listUsers(Math.min(Math.max(limit, 1), 100), offset);
  }

  @Post('users/:id/block')
  @ApiOperation({ summary: 'Block user' })
  async block(@Param('id', ParseUUIDPipe) id: string) {
    await this.admin.blockUser(id);
    return { ok: true };
  }

  @Post('users/:id/unblock')
  @ApiOperation({ summary: 'Unblock user' })
  async unblock(@Param('id', ParseUUIDPipe) id: string) {
    await this.admin.unblockUser(id);
    return { ok: true };
  }

  @Get('requests')
  @ApiOperation({ summary: 'List requests' })
  listRequests(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.admin.listRequests(Math.min(Math.max(limit, 1), 100), offset);
  }

  @Patch('requests/:id')
  @ApiOperation({ summary: 'Moderate request' })
  patchRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchModerationDto,
  ) {
    return this.admin.patchRequest(id, dto);
  }

  @Get('offers')
  @ApiOperation({ summary: 'List offers' })
  listOffers(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.admin.listOffers(Math.min(Math.max(limit, 1), 100), offset);
  }

  @Patch('offers/:id')
  @ApiOperation({ summary: 'Moderate offer' })
  patchOffer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchModerationDto,
  ) {
    return this.admin.patchOffer(id, dto);
  }

  @Get('seller-applications')
  @ApiOperation({ summary: 'List seller applications' })
  @ApiQuery({
    name: 'status',
    enum: SellerApplicationStatus,
    required: false,
  })
  listSellerApplications(
    @Query(
      'status',
      new DefaultValuePipe(undefined),
      new ParseEnumPipe(SellerApplicationStatus, { optional: true }),
    )
    status: SellerApplicationStatus | undefined,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.admin.listSellerApplications(
      status,
      Math.min(Math.max(limit, 1), 100),
      offset,
    );
  }

  @Post('seller-applications/:id/approve')
  @ApiOperation({ summary: 'Approve seller application (promotes user to seller)' })
  approveSellerApplication(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.approveSellerApplication(id);
  }

  @Post('seller-applications/:id/reject')
  @ApiOperation({ summary: 'Reject seller application' })
  rejectSellerApplication(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectSellerApplicationDto,
  ) {
    return this.admin.rejectSellerApplication(id, dto.reason);
  }

  @Post('push/test')
  @ApiOperation({
    summary: 'Send a test Expo push to a user’s registered devices',
  })
  testPush(@CurrentUser() jwt: JwtUserPayload, @Body() dto: PushTestDto) {
    const target = dto.user_id?.trim() || jwt.sub;
    return this.admin.sendTestPush(target);
  }

  @Get('stats/summary')
  @ApiOperation({ summary: 'Counts in date range' })
  stats(
    @Query('from') fromRaw?: string,
    @Query('to') toRaw?: string,
  ) {
    const to = toRaw ? new Date(toRaw) : new Date();
    const from = fromRaw
      ? new Date(fromRaw)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return this.admin.statsSummary(
        new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000),
        new Date(),
      );
    }
    return this.admin.statsSummary(from, to);
  }
}

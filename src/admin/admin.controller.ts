import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
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
  ApiOkResponse,
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
import {
  AdminFeaturedShopListDto,
  AdminHomeBannerListDto,
  AdminSpecialBuyerResponseDto,
  AuthOtpVerifyResponseDto,
  HomeBannerItemDto,
} from '../common/dto/responses.dto';
import { HomeBannersService } from '../home/home-banners.service';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateHomeBannerDto } from './dto/create-home-banner.dto';
import { PatchHomeBannerDto } from './dto/patch-home-banner.dto';
import { PatchModerationDto } from './dto/patch-moderation.dto';
import { SetSpecialBuyerDto } from './dto/set-special-buyer.dto';
import { PushTestDto } from './dto/push-test.dto';
import { ReorderHomeBannersDto } from './dto/reorder-home-banners.dto';
import { UpdateAppVersionDto } from './dto/update-app-version.dto';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly homeBanners: HomeBannersService,
  ) {}

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

  @Patch('users/:id/special-buyer')
  @ApiOperation({
    summary: 'Set special buyer flag (buyer role only)',
    description:
      'Sellers see buyer_is_special on open request payloads for this user’s requests.',
  })
  @ApiOkResponse({ type: AdminSpecialBuyerResponseDto })
  setSpecialBuyer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetSpecialBuyerDto,
  ) {
    return this.admin.setSpecialBuyer(id, dto.is_special_buyer);
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
  @ApiOperation({
    summary: 'Approve seller application (promotes user to seller)',
  })
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

  @Get('featured-shops')
  @ApiOperation({ summary: 'List sellers with their featured status' })
  @ApiOkResponse({ type: AdminFeaturedShopListDto })
  listFeaturedShops(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.admin.listFeaturedShops(
      Math.min(Math.max(limit, 1), 100),
      offset,
    );
  }

  @Post('featured-shops/:id/feature')
  @ApiOperation({ summary: 'Mark seller as featured on the home page' })
  async featureShop(@Param('id', ParseUUIDPipe) id: string) {
    await this.admin.featureShop(id);
    return { ok: true };
  }

  @Post('featured-shops/:id/unfeature')
  @ApiOperation({
    summary: 'Remove seller from featured list on the home page',
  })
  async unfeatureShop(@Param('id', ParseUUIDPipe) id: string) {
    await this.admin.unfeatureShop(id);
    return { ok: true };
  }

  @Get('home-banners')
  @ApiOperation({ summary: 'List home hero banners' })
  @ApiOkResponse({ type: AdminHomeBannerListDto })
  listHomeBanners() {
    return this.homeBanners.listAdmin();
  }

  @Post('home-banners')
  @ApiOperation({
    summary: 'Create home banner (upload image via presign first)',
  })
  @ApiCreatedResponse({ type: HomeBannerItemDto })
  createHomeBanner(@Body() dto: CreateHomeBannerDto) {
    return this.homeBanners.create({
      storage_key: dto.storage_key,
      title: dto.title,
      subtitle: dto.subtitle,
    });
  }

  @Patch('home-banners/:id')
  @ApiOperation({ summary: 'Update home banner' })
  @ApiOkResponse({ type: HomeBannerItemDto })
  patchHomeBanner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchHomeBannerDto,
  ) {
    return this.homeBanners.update(id, dto);
  }

  @Delete('home-banners/:id')
  @ApiOperation({ summary: 'Delete home banner' })
  deleteHomeBanner(@Param('id', ParseUUIDPipe) id: string) {
    return this.homeBanners.remove(id);
  }

  @Post('home-banners/reorder')
  @ApiOperation({ summary: 'Set display order (all ids required)' })
  reorderHomeBanners(@Body() dto: ReorderHomeBannersDto) {
    return this.homeBanners.reorder(dto.ordered_ids);
  }

  @Get('app-versions')
  @ApiOperation({ summary: 'Get app version config for both platforms' })
  getAppVersions() {
    return this.admin.getAppVersions();
  }

  @Patch('app-versions/:platform')
  @ApiOperation({ summary: 'Update app version config for a platform (ios or android)' })
  patchAppVersion(
    @Param('platform') platform: string,
    @Body() dto: UpdateAppVersionDto,
  ) {
    return this.admin.patchAppVersion(platform as 'ios' | 'android', dto);
  }

  @Get('stats/summary')
  @ApiOperation({ summary: 'Counts in date range' })
  stats(@Query('from') fromRaw?: string, @Query('to') toRaw?: string) {
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

import {
  Body,
  Controller,
  Get,
  Param,
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
  ApiTags,
} from '@nestjs/swagger';
import {
  PaginatedRequestListDto,
  RequestAuthorDetailDto,
  RequestMineStatsResponseDto,
  RequestPublicDto,
} from '../common/dto/responses.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { MineListScope, MineQueryDto } from './dto/mine-query.dto';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { AddRequestPhotosDto } from './dto/add-request-photos.dto';
import { AcceptOfferDto } from './dto/accept-offer.dto';
import { CancelAcceptedOfferDto } from './dto/cancel-accepted-offer.dto';
import { CreateRequestDto } from './dto/create-request.dto';
import { PatchRequestDto } from './dto/patch-request.dto';
import { OffersService } from '../offers/offers.service';
import { RequestsService } from './requests.service';

@ApiTags('requests')
@ApiBearerAuth('access-token')
@Controller('requests')
export class RequestsController {
  constructor(
    private readonly requests: RequestsService,
    private readonly offers: OffersService,
  ) {}

  @Get('mine')
  @ApiOperation({
    summary:
      'My requests (paginated). scope=active (default): open only; scope=history: closed and cancelled.',
  })
  @ApiOkResponse({ type: PaginatedRequestListDto })
  mine(@CurrentUser() u: JwtUserPayload, @Query() q: MineQueryDto) {
    return this.requests.listMine(
      u.sub,
      q.limit,
      q.cursor,
      q.scope ?? MineListScope.ACTIVE,
    );
  }

  @Get('mine/stats')
  @ApiOperation({
    summary: 'Total offer count across my open requests (e.g. tab badge)',
  })
  @ApiOkResponse({ type: RequestMineStatsResponseDto })
  mineStats(@CurrentUser() u: JwtUserPayload) {
    return this.requests.mineOfferStats(u.sub);
  }

  @Get('open')
  @ApiOperation({
    summary:
      'Open requests feed (excludes own). Seller or admin only; buyers receive 403.',
  })
  @ApiOkResponse({ type: PaginatedRequestListDto })
  open(@CurrentUser() u: JwtUserPayload, @Query() q: PaginationQueryDto) {
    return this.requests.listOpen(u.sub, u.role, q.limit, q.cursor);
  }

  @Post(':id/accept-offer')
  @ApiOperation({
    summary:
      'Buyer: accept offer (reveals seller contact; lock until deal or cancel)',
  })
  @ApiOkResponse({ type: RequestAuthorDetailDto })
  async acceptOffer(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: JwtUserPayload,
    @Body() dto: AcceptOfferDto,
  ) {
    await this.offers.acceptOfferByBuyer(id, u.sub, dto.offer_id);
    return this.requests.getAuthorDetail(id, u.sub, false);
  }

  @Post(':id/cancel-accepted-offer')
  @ApiOperation({
    summary:
      'Buyer: propose mutual cancel on active deal (both parties must submit reason)',
  })
  async cancelAcceptedOffer(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: JwtUserPayload,
    @Body() dto: CancelAcceptedOfferDto,
  ) {
    await this.offers.cancelAcceptedOfferByBuyer(id, u.sub, dto.cancel_reason);
    return this.requests.getAuthorDetail(id, u.sub, false);
  }

  @Get(':id/public')
  @ApiOperation({
    summary:
      'Seller view: one open visible request. Seller or admin only; buyers receive 403.',
  })
  @ApiOkResponse({ type: RequestPublicDto })
  publicDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: JwtUserPayload,
  ) {
    return this.requests.getPublicForSeller(id, u.sub, u.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Author: request detail with offers' })
  @ApiOkResponse({ type: RequestAuthorDetailDto })
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: JwtUserPayload,
    @Query('include_hidden') include_hidden?: string,
  ) {
    const includeHidden = include_hidden === 'true' || include_hidden === '1';
    return this.requests.getAuthorDetail(id, u.sub, includeHidden);
  }

  @Post()
  @ApiOperation({ summary: 'Create request' })
  @ApiCreatedResponse({ type: RequestAuthorDetailDto })
  create(@CurrentUser() u: JwtUserPayload, @Body() dto: CreateRequestDto) {
    return this.requests.create(u.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update / cancel own request' })
  patch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: JwtUserPayload,
    @Body() dto: PatchRequestDto,
  ) {
    return this.requests.patchAuthor(id, u.sub, dto);
  }

  @Post(':id/photos')
  @ApiOperation({ summary: 'Append photos to open request' })
  addPhotos(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: JwtUserPayload,
    @Body() dto: AddRequestPhotosDto,
  ) {
    return this.requests.addPhotos(id, u.sub, dto);
  }
}

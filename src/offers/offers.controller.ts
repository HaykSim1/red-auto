import {
  Body,
  Controller,
  Delete,
  forwardRef,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedSellerOfferHistoryDto } from '../common/dto/responses.dto';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { CancelAcceptedOfferDto } from '../requests/dto/cancel-accepted-offer.dto';
import { SelectionsService } from '../selections/selections.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { PatchOfferDto } from './dto/patch-offer.dto';
import { OffersService } from './offers.service';

@ApiTags('offers')
@ApiBearerAuth('access-token')
@Controller('requests/:requestId/offers')
export class OffersOnRequestController {
  constructor(private readonly offers: OffersService) {}

  @Post()
  @ApiOperation({ summary: 'Create offer (seller)' })
  create(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() u: JwtUserPayload,
    @Body() dto: CreateOfferDto,
  ) {
    return this.offers.create(requestId, u.sub, u.role, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List offers (request author only)' })
  list(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() u: JwtUserPayload,
    @Query('include_hidden') include_hidden?: string,
  ) {
    const includeHidden = include_hidden === 'true' || include_hidden === '1';
    return this.offers.listForAuthor(requestId, u.sub, includeHidden);
  }
}

@ApiTags('offers')
@ApiBearerAuth('access-token')
@Controller('offers')
export class OffersController {
  constructor(
    private readonly offers: OffersService,
    @Inject(forwardRef(() => SelectionsService))
    private readonly selections: SelectionsService,
  ) {}

  @Get('mine/history')
  @ApiOperation({
    summary:
      'Seller: paginated closed offers (success = deal completed, canceled = mutual or acknowledged buyer cancel)',
  })
  @ApiOkResponse({ type: PaginatedSellerOfferHistoryDto })
  mineHistory(
    @CurrentUser() u: JwtUserPayload,
    @Query() q: PaginationQueryDto,
  ) {
    return this.offers.listSellerHistory(u.sub, u.role, q.limit, q.cursor);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update own offer' })
  patch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: JwtUserPayload,
    @Body() dto: PatchOfferDto,
  ) {
    return this.offers.patch(u.sub, id, u.role, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-hide own offer' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: JwtUserPayload,
  ) {
    await this.offers.softDelete(u.sub, id, u.role);
    return { ok: true };
  }

  @Post(':id/acknowledge')
  @ApiOperation({
    summary:
      'Seller: acknowledge buyer cancellation (legacy buyer_cancelled rows only)',
  })
  acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: JwtUserPayload,
  ) {
    return this.offers.acknowledgeBuyerCancellation(u.sub, id, u.role);
  }

  @Post(':id/confirm-deal-complete')
  @ApiOperation({
    summary:
      'Seller: confirm deal complete (closes request when buyer has also confirmed)',
  })
  confirmDealComplete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: JwtUserPayload,
  ) {
    return this.selections.sellerMarkDealComplete(u.sub, id, u.role);
  }

  @Post(':id/cancel-accepted-offer')
  @ApiOperation({
    summary:
      'Seller: propose cancel on active accepted deal (mutual cancel with buyer)',
  })
  cancelAcceptedOfferAsSeller(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: JwtUserPayload,
    @Body() dto: CancelAcceptedOfferDto,
  ) {
    return this.offers.cancelAcceptedOfferBySeller(
      u.sub,
      id,
      u.role,
      dto.cancel_reason,
    );
  }
}

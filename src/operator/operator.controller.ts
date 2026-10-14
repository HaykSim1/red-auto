import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
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
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  OfferDto,
  OkResponseDto,
  OperatorDealCompleteResultDto,
  OperatorOffersResponseDto,
  OperatorRequestDetailDto,
  OperatorShopListDto,
  PaginatedOperatorRequestListDto,
} from '../common/dto/responses.dto';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { UserRole } from '../database/enums';
import { PatchOfferDto } from '../offers/dto/patch-offer.dto';
import { CancelAcceptedOfferDto } from '../requests/dto/cancel-accepted-offer.dto';
import { OpenRequestsQueryDto } from '../requests/dto/open-requests-query.dto';
import { OperatorCreateOfferDto } from './dto/operator-create-offer.dto';
import { OperatorService } from './operator.service';

@ApiTags('operator')
@ApiBearerAuth('access-token')
@Roles(UserRole.OPERATOR)
@Controller('operator')
export class OperatorController {
  constructor(private readonly operator: OperatorService) {}

  @Get('shops')
  @ApiOperation({
    summary: 'Operator: managed shop personas available to post as',
  })
  @ApiOkResponse({ type: OperatorShopListDto })
  listShops() {
    return this.operator.listShops();
  }

  @Get('requests')
  @ApiOperation({
    summary:
      'Operator: open requests feed (same filters as the seller feed) with the managed shops that already answered',
  })
  @ApiOkResponse({ type: PaginatedOperatorRequestListDto })
  listRequests(
    @CurrentUser() u: JwtUserPayload,
    @Query() q: OpenRequestsQueryDto,
  ) {
    return this.operator.listRequests(u.sub, q);
  }

  @Get('requests/:id')
  @ApiOperation({
    summary: 'Operator: request detail with offers by managed shops',
  })
  @ApiOkResponse({ type: OperatorRequestDetailDto })
  getRequest(@Param('id', ParseUUIDPipe) id: string) {
    return this.operator.getRequest(id);
  }

  @Post('requests/:id/offers')
  @ApiOperation({ summary: 'Operator: submit an offer as a managed shop' })
  @ApiCreatedResponse({ type: OfferDto })
  createOffer(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: JwtUserPayload,
    @Body() dto: OperatorCreateOfferDto,
  ) {
    return this.operator.createOffer(u.sub, id, dto);
  }

  @Get('offers')
  @ApiOperation({
    summary: 'Operator: all offers by managed shops, newest first',
  })
  @ApiOkResponse({ type: OperatorOffersResponseDto })
  listOffers(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.operator.listOffers(Math.min(Math.max(limit, 1), 100), offset);
  }

  @Patch('offers/:id')
  @ApiOperation({ summary: 'Operator: update a managed shop offer' })
  @ApiOkResponse({ type: OfferDto })
  patchOffer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchOfferDto,
  ) {
    return this.operator.patchOffer(id, dto);
  }

  @Delete('offers/:id')
  @ApiOperation({ summary: 'Operator: soft-hide a managed shop offer' })
  @ApiOkResponse({ type: OkResponseDto })
  async deleteOffer(@Param('id', ParseUUIDPipe) id: string) {
    await this.operator.deleteOffer(id);
    return { ok: true };
  }

  @Post('offers/:id/acknowledge')
  @ApiOperation({ summary: 'Operator: acknowledge buyer cancellation' })
  @ApiOkResponse({ type: OkResponseDto })
  acknowledge(@Param('id', ParseUUIDPipe) id: string) {
    return this.operator.acknowledge(id);
  }

  @Post('offers/:id/confirm-deal-complete')
  @ApiOperation({
    summary: 'Operator: confirm deal complete as the managed shop',
  })
  @ApiOkResponse({ type: OperatorDealCompleteResultDto })
  confirmDealComplete(@Param('id', ParseUUIDPipe) id: string) {
    return this.operator.confirmDealComplete(id);
  }

  @Post('offers/:id/cancel-accepted-offer')
  @ApiOperation({ summary: 'Operator: propose cancel on an active deal' })
  @ApiOkResponse({ type: OkResponseDto })
  async cancelAcceptedOffer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAcceptedOfferDto,
  ) {
    await this.operator.cancelAcceptedOffer(id, dto.cancel_reason);
    return { ok: true };
  }
}

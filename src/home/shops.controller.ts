import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FeaturedShopItemDto, ShopDetailResponseDto } from '../common/dto/responses.dto';
import { HomeService } from './home.service';

@ApiTags('shops')
@ApiBearerAuth('access-token')
@Controller('shops')
export class ShopsController {
  constructor(private readonly home: HomeService) {}

  @Get('featured')
  @ApiOperation({
    summary: 'Top-rated sellers with a shop name (MVP; not paid placement)',
  })
  @ApiOkResponse({ type: [FeaturedShopItemDto] })
  featured() {
    return this.home.getFeaturedShops();
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Public shop profile: name, logo, description (shop address text), aggregate rating, recent reviews (no phone/messengers)',
  })
  @ApiOkResponse({ type: ShopDetailResponseDto })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.home.getPublicShopDetail(id);
  }
}

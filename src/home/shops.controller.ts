import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  FeaturedShopItemDto,
  ShopCatalogItemDto,
  ShopCatalogListResponseDto,
  ShopDetailResponseDto,
} from '../common/dto/responses.dto';
import { ShopCatalogQueryDto } from '../inventory/dto/shop-catalog-query.dto';
import { InventoryService } from '../inventory/inventory.service';
import { HomeService } from './home.service';

@ApiTags('shops')
@ApiBearerAuth('access-token')
@Controller('shops')
export class ShopsController {
  constructor(
    private readonly home: HomeService,
    private readonly inventory: InventoryService,
  ) {}

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

  @Get(':id/items')
  @ApiOperation({
    summary: 'Public shop catalog: active inventory items (paginated, search)',
  })
  @ApiOkResponse({ type: ShopCatalogListResponseDto })
  async items(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: ShopCatalogQueryDto,
  ) {
    await this.home.assertPublicShop(id);
    return this.inventory.listPublic(id, q);
  }

  @Get(':id/items/:itemId')
  @ApiOperation({ summary: 'Public shop catalog item' })
  @ApiOkResponse({ type: ShopCatalogItemDto })
  async item(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    await this.home.assertPublicShop(id);
    return this.inventory.getPublic(id, itemId);
  }
}

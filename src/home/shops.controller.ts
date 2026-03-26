import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  featured() {
    return this.home.getFeaturedShops();
  }
}

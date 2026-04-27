import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  HomeBannerListDto,
  HomeSummaryResponseDto,
} from '../common/dto/responses.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { HomeBannersService } from './home-banners.service';
import { HomeService } from './home.service';

@ApiTags('home')
@ApiBearerAuth('access-token')
@Controller('home')
export class HomeController {
  constructor(
    private readonly home: HomeService,
    private readonly homeBanners: HomeBannersService,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'Dashboard counters (role-aware)' })
  @ApiOkResponse({ type: HomeSummaryResponseDto })
  summary(@CurrentUser() u: JwtUserPayload) {
    return this.home.getSummary(u.sub, u.role);
  }

  @Get('banners')
  @ApiOperation({
    summary: 'Home hero banners (ordered); empty list if none configured',
  })
  @ApiOkResponse({ type: HomeBannerListDto })
  banners() {
    return this.homeBanners.listPublic();
  }
}

import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { HomeService } from './home.service';

@ApiTags('home')
@ApiBearerAuth('access-token')
@Controller('home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Dashboard counters (role-aware)' })
  summary(@CurrentUser() u: JwtUserPayload) {
    return this.home.getSummary(u.sub, u.role);
  }
}

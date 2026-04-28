import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AppVersionCheckDto } from '../common/dto/responses.dto';
import { AppVersionService } from './app-version.service';
import { CheckVersionQueryDto } from './dto/check-version-query.dto';

@ApiTags('app-version')
@Controller('app-version')
export class AppVersionController {
  constructor(private readonly service: AppVersionService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Check if current build requires a force update' })
  @ApiOkResponse({ type: AppVersionCheckDto })
  check(@Query() query: CheckVersionQueryDto): Promise<AppVersionCheckDto> {
    return this.service.check(query.platform, query.build);
  }
}

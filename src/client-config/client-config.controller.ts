import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { resolveMediaBaseUrl } from './resolve-media-base-url';

@ApiTags('client-config')
@Controller('client-config')
export class ClientConfigController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Public runtime config for clients (e.g. media URLs)',
  })
  clientConfig(): { media_base_url: string | null } {
    return { media_base_url: resolveMediaBaseUrl(this.config) };
  }
}

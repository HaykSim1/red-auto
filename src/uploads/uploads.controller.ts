import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PresignResponseDto } from '../common/dto/responses.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { PresignDto } from './dto/presign.dto';
import { UploadsService } from './uploads.service';

@ApiTags('uploads')
@ApiBearerAuth('access-token')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('presign')
  @ApiOperation({ summary: 'Presigned PUT for request/offer photo' })
  @ApiCreatedResponse({ type: PresignResponseDto })
  presign(@CurrentUser() u: JwtUserPayload, @Body() dto: PresignDto) {
    return this.uploads.presign(u, dto);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { CreateSelectionDto } from './dto/create-selection.dto';
import { SelectionsService } from './selections.service';

@ApiTags('selections')
@ApiBearerAuth('access-token')
@Controller('requests/:requestId/selection')
export class SelectionsController {
  constructor(private readonly selections: SelectionsService) {}

  @Post()
  @ApiOperation({
    summary:
      'Buyer: mark deal complete (closes request when seller has also confirmed)',
  })
  create(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() u: JwtUserPayload,
    @Body() dto: CreateSelectionDto,
  ) {
    return this.selections.createOrReplace(requestId, u.sub, dto.offer_id);
  }

  @Get()
  @ApiOperation({ summary: 'Get selection + seller contact (author only)' })
  get(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() u: JwtUserPayload,
  ) {
    return this.selections.getForAuthor(requestId, u.sub);
  }
}

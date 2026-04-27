import { Body, Controller, Get, HttpStatus, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MeResponseDto } from '../common/dto/responses.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiException } from '../common/exceptions/api.exception';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

@ApiTags('me')
@ApiBearerAuth('access-token')
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Current user profile' })
  @ApiOkResponse({ type: MeResponseDto })
  async me(@CurrentUser() jwt: JwtUserPayload) {
    const me = await this.users.getMe(jwt.sub);
    if (!me) {
      throw new ApiException(
        'not_found',
        'User not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return me;
  }

  @Patch()
  @ApiOperation({ summary: 'Update profile' })
  @ApiOkResponse({ type: MeResponseDto })
  patchMe(@CurrentUser() jwt: JwtUserPayload, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(jwt.sub, dto);
  }
}

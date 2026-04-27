import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { DevicesService } from './devices.service';

@ApiTags('devices')
@ApiBearerAuth('access-token')
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  @ApiOperation({ summary: 'Register Expo push token' })
  register(@CurrentUser() u: JwtUserPayload, @Body() dto: RegisterDeviceDto) {
    return this.devices.register(u.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Unregister device' })
  async remove(
    @CurrentUser() u: JwtUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.devices.remove(u.sub, id);
    return { ok: true };
  }
}

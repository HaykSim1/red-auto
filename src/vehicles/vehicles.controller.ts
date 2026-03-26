import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@ApiBearerAuth('access-token')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  @ApiOperation({ summary: 'List saved vehicles' })
  list(@CurrentUser() u: JwtUserPayload) {
    return this.vehicles.list(u.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create vehicle' })
  create(@CurrentUser() u: JwtUserPayload, @Body() dto: CreateVehicleDto) {
    return this.vehicles.create(u.sub, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vehicle' })
  get(
    @CurrentUser() u: JwtUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vehicles.getOne(u.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update vehicle' })
  patch(
    @CurrentUser() u: JwtUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehicles.update(u.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete vehicle' })
  async remove(
    @CurrentUser() u: JwtUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.vehicles.remove(u.sub, id);
    return { ok: true };
  }
}

import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { UserRole } from '../database/enums';
import { CreateSellerApplicationDto } from './dto/create-seller-application.dto';
import { SellerApplicationsService } from './seller-applications.service';

@ApiTags('seller-applications')
@ApiBearerAuth('access-token')
@Controller('seller-applications')
export class SellerApplicationsController {
  constructor(private readonly sellerApplications: SellerApplicationsService) {}

  @Post()
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Submit seller application (buyer only)' })
  create(
    @CurrentUser() jwt: JwtUserPayload,
    @Body() dto: CreateSellerApplicationDto,
  ) {
    return this.sellerApplications.create(jwt, dto);
  }
}

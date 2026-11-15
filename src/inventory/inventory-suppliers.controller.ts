import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  InventorySupplierDto,
  InventorySupplierListResponseDto,
} from '../common/dto/responses.dto';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { UserRole } from '../database/enums';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('inventory')
@ApiBearerAuth('access-token')
@Roles(UserRole.SELLER, UserRole.ADMIN)
@Controller('inventory/suppliers')
export class InventorySuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @ApiOperation({ summary: 'My suppliers (all, by name)' })
  @ApiOkResponse({ type: InventorySupplierListResponseDto })
  list(@CurrentUser() u: JwtUserPayload) {
    return this.suppliers.list(u.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create a supplier' })
  @ApiCreatedResponse({ type: InventorySupplierDto })
  create(@CurrentUser() u: JwtUserPayload, @Body() dto: CreateSupplierDto) {
    return this.suppliers.create(u.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a supplier' })
  @ApiOkResponse({ type: InventorySupplierDto })
  update(
    @CurrentUser() u: JwtUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliers.update(u.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a supplier (items keep existing, lose the link)',
  })
  @ApiNoContentResponse({ description: 'Deleted' })
  async remove(
    @CurrentUser() u: JwtUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.suppliers.remove(u.sub, id);
  }
}

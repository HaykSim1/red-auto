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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  InventoryItemDto,
  InventoryItemListResponseDto,
  InventoryRecognitionDto,
  InventoryStatsDto,
} from '../common/dto/responses.dto';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { UserRole } from '../database/enums';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { CreateRecognitionDto } from './dto/create-recognition.dto';
import { ListInventoryItemsQueryDto } from './dto/list-inventory-items-query.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { InventoryService } from './inventory.service';
import { RecognitionService } from './recognition/recognition.service';

@ApiTags('inventory')
@ApiBearerAuth('access-token')
@Roles(UserRole.SELLER, UserRole.ADMIN)
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly recognition: RecognitionService,
  ) {}

  @Post('recognitions')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Start AI recognition of a part from 1-3 box photos',
  })
  @ApiResponse({ status: 202, type: InventoryRecognitionDto })
  startRecognition(
    @CurrentUser() u: JwtUserPayload,
    @Body() dto: CreateRecognitionDto,
  ) {
    return this.recognition.start(u, dto);
  }

  @Get('recognitions/:id')
  @ApiOperation({ summary: 'Recognition status and result (poll)' })
  @ApiOkResponse({ type: InventoryRecognitionDto })
  getRecognition(
    @CurrentUser() u: JwtUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recognition.get(u.sub, id);
  }

  @Get('items')
  @ApiOperation({ summary: 'My inventory items (paginated, searchable)' })
  @ApiOkResponse({ type: InventoryItemListResponseDto })
  list(
    @CurrentUser() u: JwtUserPayload,
    @Query() q: ListInventoryItemsQueryDto,
  ) {
    return this.inventory.list(u.sub, q);
  }

  @Get('items/stats')
  @ApiOperation({
    summary: 'Inventory counters (active, drafts, out of stock)',
  })
  @ApiOkResponse({ type: InventoryStatsDto })
  stats(@CurrentUser() u: JwtUserPayload) {
    return this.inventory.stats(u.sub);
  }

  @Post('items')
  @ApiOperation({ summary: 'Create an inventory item' })
  @ApiCreatedResponse({ type: InventoryItemDto })
  create(
    @CurrentUser() u: JwtUserPayload,
    @Body() dto: CreateInventoryItemDto,
  ) {
    return this.inventory.create(u.sub, dto);
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Get an inventory item' })
  @ApiOkResponse({ type: InventoryItemDto })
  get(
    @CurrentUser() u: JwtUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventory.get(u.sub, id);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update an inventory item' })
  @ApiOkResponse({ type: InventoryItemDto })
  update(
    @CurrentUser() u: JwtUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventory.update(u.sub, id, dto);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive an inventory item' })
  @ApiNoContentResponse({ description: 'Archived' })
  async archive(
    @CurrentUser() u: JwtUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.inventory.archive(u.sub, id);
  }
}

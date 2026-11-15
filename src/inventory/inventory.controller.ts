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
  InventoryItemLookupResponseDto,
  InventoryMovementListResponseDto,
  InventoryMovementResultDto,
  InventoryRecognitionDto,
  InventoryStatsDto,
} from '../common/dto/responses.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { UserRole } from '../database/enums';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { CreateRecognitionDto } from './dto/create-recognition.dto';
import { ListInventoryItemsQueryDto } from './dto/list-inventory-items-query.dto';
import {
  CreateMovementByCodeDto,
  CreateMovementDto,
  LookupItemsQueryDto,
  UpdateMovementDto,
} from './dto/movement.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { InventoryService } from './inventory.service';
import { MovementsService } from './movements.service';
import { RecognitionService } from './recognition/recognition.service';

@ApiTags('inventory')
@ApiBearerAuth('access-token')
@Roles(UserRole.SELLER, UserRole.ADMIN)
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly recognition: RecognitionService,
    private readonly movements: MovementsService,
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

  // Declared before items/:id so "lookup" is not parsed as an id.
  @Get('items/lookup')
  @ApiOperation({
    summary: 'Find my items by a scanned barcode or a typed part number',
  })
  @ApiOkResponse({ type: InventoryItemLookupResponseDto })
  async lookup(
    @CurrentUser() u: JwtUserPayload,
    @Query() q: LookupItemsQueryDto,
  ): Promise<InventoryItemLookupResponseDto> {
    return { items: await this.inventory.lookup(u.sub, q.code) };
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

  // ── Stock movements ──

  @Post('items/:id/movements')
  @ApiOperation({
    summary:
      'Record a stock movement (receive, sell, write_off, return, adjust)',
  })
  @ApiCreatedResponse({ type: InventoryMovementResultDto })
  createMovement(
    @CurrentUser() u: JwtUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMovementDto,
  ) {
    return this.movements.create(u.sub, u.sub, id, dto);
  }

  @Get('items/:id/movements')
  @ApiOperation({ summary: 'Movement history of an item, newest first' })
  @ApiOkResponse({ type: InventoryMovementListResponseDto })
  itemMovements(
    @CurrentUser() u: JwtUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: PaginationQueryDto,
  ) {
    return this.movements.list(u.sub, id, q);
  }

  @Get('movements')
  @ApiOperation({ summary: 'Recent movements across my inventory' })
  @ApiOkResponse({ type: InventoryMovementListResponseDto })
  shopMovements(
    @CurrentUser() u: JwtUserPayload,
    @Query() q: PaginationQueryDto,
  ) {
    return this.movements.list(u.sub, null, q);
  }

  @Post('movements/by-code')
  @ApiOperation({
    summary:
      'Scanner endpoint: resolve a barcode / part number and record a movement',
  })
  @ApiCreatedResponse({ type: InventoryMovementResultDto })
  createMovementByCode(
    @CurrentUser() u: JwtUserPayload,
    @Body() dto: CreateMovementByCodeDto,
  ) {
    return this.movements.createByCode(u.sub, u.sub, dto);
  }

  @Patch('movements/:id')
  @ApiOperation({
    summary:
      "Change the amount of an item's latest movement (within 10 minutes)",
  })
  @ApiOkResponse({ type: InventoryMovementResultDto })
  updateMovement(
    @CurrentUser() u: JwtUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMovementDto,
  ) {
    return this.movements.update(u.sub, id, dto);
  }

  @Delete('movements/:id')
  @ApiOperation({
    summary:
      "Undo an item's latest movement (within 10 minutes); returns the item",
  })
  @ApiOkResponse({ type: InventoryItemDto })
  removeMovement(
    @CurrentUser() u: JwtUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.movements.remove(u.sub, id);
  }
}

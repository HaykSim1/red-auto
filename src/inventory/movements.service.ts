import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  InventoryItemDto,
  InventoryMovementDto,
  InventoryMovementListResponseDto,
  InventoryMovementResultDto,
} from '../common/dto/responses.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ApiException } from '../common/exceptions/api.exception';
import { decodeCursor, encodeCursor } from '../common/utils/cursor-pagination';
import { InventoryItem } from '../database/entities/inventory-item.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import {
  CreateMovementByCodeDto,
  CreateMovementDto,
  UpdateMovementDto,
} from './dto/movement.dto';
import { InventoryService } from './inventory.service';
import {
  deltaFor,
  insufficientStock,
  itemNotFound,
  lockItem,
  recordMovement,
} from './movements';

/** A movement can be edited or undone only this long after it was made. */
export const MOVEMENT_EDIT_WINDOW_MS = 10 * 60 * 1000;

const movementNotFound = () =>
  new ApiException(
    'movement_not_found',
    'Movement not found.',
    HttpStatus.NOT_FOUND,
  );

@Injectable()
export class MovementsService {
  constructor(
    @InjectRepository(InventoryMovement)
    private readonly movements: Repository<InventoryMovement>,
    private readonly ds: DataSource,
    private readonly inventory: InventoryService,
  ) {}

  async create(
    shopId: string,
    userId: string,
    itemId: string,
    dto: CreateMovementDto,
  ): Promise<InventoryMovementResultDto> {
    const movement = await this.ds.transaction(async (m) => {
      const item = await lockItem(m, shopId, itemId);
      return recordMovement(m, item, {
        shopId,
        userId,
        type: dto.type,
        delta: deltaFor(dto.type, dto.quantity, item.quantity),
        unitCost: dto.unit_cost,
        note: dto.note,
      });
    });
    return this.result(shopId, itemId, movement);
  }

  /** The scanner endpoint: resolve a barcode / part number, then move. */
  async createByCode(
    shopId: string,
    userId: string,
    dto: CreateMovementByCodeDto,
  ): Promise<InventoryMovementResultDto> {
    const matches = await this.inventory.resolveCode(shopId, dto.code);
    if (matches.length === 0) throw itemNotFound();
    if (matches.length > 1) {
      throw new ApiException(
        'movement_code_ambiguous',
        'Several items match this code.',
        HttpStatus.CONFLICT,
        { items: matches.map((i) => this.inventory.serialize(i)) },
      );
    }
    return this.create(shopId, userId, matches[0].id, {
      type: dto.type,
      quantity: dto.quantity ?? 1,
      unit_cost: dto.unit_cost,
      note: dto.note,
    });
  }

  /** Change the amount of a fresh movement (the sale card's −/+). */
  async update(
    shopId: string,
    movementId: string,
    dto: UpdateMovementDto,
  ): Promise<InventoryMovementResultDto> {
    const { movement, itemId } = await this.ds.transaction(async (m) => {
      const { movement, item } = await this.lockEditable(m, shopId, movementId);
      const stockBefore = item.quantity - movement.delta;
      const delta = deltaFor(movement.type, dto.quantity, stockBefore);
      const after = stockBefore + delta;
      if (after < 0) throw insufficientStock(stockBefore);
      if (delta !== movement.delta) {
        await m
          .getRepository(InventoryMovement)
          .update({ id: movement.id }, { delta, quantityAfter: after });
        await m
          .getRepository(InventoryItem)
          .update({ id: item.id }, { quantity: after });
        movement.delta = delta;
        movement.quantityAfter = after;
      }
      return { movement, itemId: item.id };
    });
    return this.result(shopId, itemId, movement);
  }

  /** Undo: remove a fresh movement and restore the stock it changed. */
  async remove(shopId: string, movementId: string): Promise<InventoryItemDto> {
    const itemId = await this.ds.transaction(async (m) => {
      const { movement, item } = await this.lockEditable(m, shopId, movementId);
      const restored = item.quantity - movement.delta;
      if (restored < 0) throw insufficientStock(item.quantity);
      await m.getRepository(InventoryMovement).delete({ id: movement.id });
      await m
        .getRepository(InventoryItem)
        .update({ id: item.id }, { quantity: restored });
      return item.id;
    });
    return this.inventory.get(shopId, itemId);
  }

  /** Newest first. With `itemId`: that item's history; without: the whole shop. */
  async list(
    shopId: string,
    itemId: string | null,
    q: PaginationQueryDto,
  ): Promise<InventoryMovementListResponseDto> {
    if (itemId) await this.inventory.get(shopId, itemId); // 404 for a foreign item
    const take = Math.min(Math.max(q.limit ?? 20, 1), 100);
    const qb = this.movements
      .createQueryBuilder('mv')
      .innerJoinAndSelect('mv.item', 'item')
      .where('mv.shop_id = :shopId', { shopId })
      .orderBy('mv.createdAt', 'DESC')
      .addOrderBy('mv.id', 'DESC')
      .limit(take + 1);
    if (itemId) qb.andWhere('mv.item_id = :itemId', { itemId });
    const cursor = q.cursor ? decodeCursor(q.cursor) : null;
    if (cursor) {
      qb.andWhere(
        '(mv.created_at < :ct OR (mv.created_at = :ct AND mv.id < :cid))',
        { ct: new Date(cursor.t), cid: cursor.id },
      );
    }
    const found = await qb.getMany();
    const hasMore = found.length > take;
    const rows = hasMore ? found.slice(0, take) : found;
    const last = rows[rows.length - 1];
    return {
      items: rows.map((r) => this.serialize(r, r.item.name)),
      next_cursor:
        hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  serialize(mv: InventoryMovement, itemName: string): InventoryMovementDto {
    return {
      id: mv.id,
      item_id: mv.item.id,
      item_name: itemName,
      type: mv.type,
      delta: mv.delta,
      quantity_after: mv.quantityAfter,
      unit_cost:
        mv.unitCost === null || mv.unitCost === undefined
          ? null
          : Number(mv.unitCost),
      note: mv.note ?? null,
      created_at: mv.createdAt.toISOString(),
    };
  }

  /**
   * Loads a movement, locks its item, and enforces the edit rule: only the
   * item's latest movement, and only within the edit window. Anything older
   * is history and is corrected with a new movement instead.
   */
  private async lockEditable(
    m: EntityManager,
    shopId: string,
    movementId: string,
  ): Promise<{ movement: InventoryMovement; item: InventoryItem }> {
    const repo = m.getRepository(InventoryMovement);
    const found = await repo.findOne({
      where: { id: movementId, shop: { id: shopId } },
      relations: { item: true },
    });
    if (!found) throw movementNotFound();
    const item = await lockItem(m, shopId, found.item.id);
    // Re-read under the item lock: a concurrent edit may have changed it.
    const movement = await repo.findOne({
      where: { id: movementId },
      relations: { item: true },
    });
    if (!movement) throw movementNotFound();
    const latest = await repo.findOne({
      where: { item: { id: item.id } },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    const fresh =
      Date.now() - movement.createdAt.getTime() <= MOVEMENT_EDIT_WINDOW_MS;
    if (!latest || latest.id !== movement.id || !fresh) {
      throw new ApiException(
        'movement_locked',
        'Only the latest movement of an item can be changed, within 10 minutes.',
        HttpStatus.CONFLICT,
      );
    }
    return { movement, item };
  }

  private async result(
    shopId: string,
    itemId: string,
    movement: InventoryMovement,
  ): Promise<InventoryMovementResultDto> {
    const item = await this.inventory.get(shopId, itemId);
    return {
      movement: this.serialize(
        { ...movement, item: { id: itemId } } as InventoryMovement,
        item.name,
      ),
      item,
    };
  }
}

import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  InventoryBatchResponseDto,
  InventoryBatchResultDto,
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
  BatchOperationDto,
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

/** A device clock this far ahead of the server is treated as wrong. */
export const OCCURRED_AT_MAX_AHEAD_MS = 5 * 60 * 1000;

/**
 * Device time of an offline operation. There is no lower bound: a phone may
 * have been offline for days and the sale still happened. A time in the
 * future can only be a wrong clock, so it becomes "now".
 */
export function clampOccurredAt(iso: string, now = Date.now()): Date {
  const t = new Date(iso).getTime();
  return new Date(
    Number.isNaN(t) || t > now + OCCURRED_AT_MAX_AHEAD_MS ? now : t,
  );
}

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
      // Under the item lock: a retry of the same operation finds the first one.
      const earlier = await this.findByClientOp(m, shopId, dto.client_op_id);
      if (earlier) return earlier;
      return recordMovement(m, item, {
        shopId,
        userId,
        type: dto.type,
        delta: deltaFor(dto.type, dto.quantity, item.quantity),
        unitCost: dto.unit_cost,
        note: dto.note,
        clientOpId: dto.client_op_id,
      });
    });
    return this.result(shopId, movement.item?.id ?? itemId, movement);
  }

  /**
   * Operations made on a device with no connection, in the order they were
   * made. Each runs in its own transaction, so one that can never succeed
   * (the item is gone) is reported and the rest still apply. They already
   * happened in the shop, so a sale larger than the stock is forced rather
   * than refused.
   */
  async applyBatch(
    shopId: string,
    userId: string,
    operations: BatchOperationDto[],
  ): Promise<InventoryBatchResponseDto> {
    const results: InventoryBatchResultDto[] = [];
    for (const op of operations) {
      results.push(await this.applyOne(shopId, userId, op));
    }
    return { results };
  }

  private async applyOne(
    shopId: string,
    userId: string,
    op: BatchOperationDto,
  ): Promise<InventoryBatchResultDto> {
    let outcome: { movement: InventoryMovement; duplicate: boolean };
    try {
      outcome = await this.ds.transaction(async (m) => {
        // Before the item lookup: an operation recorded earlier stays a
        // duplicate even if its item has been archived since.
        const before = await this.findByClientOp(m, shopId, op.client_op_id);
        if (before) return { movement: before, duplicate: true };
        const item = await lockItem(m, shopId, op.item_id);
        const earlier = await this.findByClientOp(m, shopId, op.client_op_id);
        if (earlier) return { movement: earlier, duplicate: true };
        const movement = await recordMovement(m, item, {
          shopId,
          userId,
          type: op.type,
          delta: deltaFor(op.type, op.quantity, item.quantity),
          unitCost: op.unit_cost,
          note: op.note,
          clientOpId: op.client_op_id,
          occurredAt: clampOccurredAt(op.occurred_at),
          force: true,
        });
        return { movement, duplicate: false };
      });
    } catch (e) {
      // Only errors that will be the same on every retry are final; anything
      // else fails the request so the client sends the batch again.
      if (e instanceof ApiException && e.getStatus() < 500) {
        return {
          client_op_id: op.client_op_id,
          status: 'rejected',
          error_code: e.code,
        };
      }
      throw e;
    }
    const itemId = outcome.movement.item?.id ?? op.item_id;
    const item = await this.inventory.getIncludingArchived(shopId, itemId);
    return {
      client_op_id: op.client_op_id,
      status: outcome.duplicate ? 'duplicate' : 'applied',
      movement: this.serialize(
        { ...outcome.movement, item: { id: itemId } } as InventoryMovement,
        item.name,
      ),
      item,
    };
  }

  private async findByClientOp(
    m: EntityManager,
    shopId: string,
    clientOpId: string | undefined,
  ): Promise<InventoryMovement | null> {
    if (!clientOpId) return null;
    return m.getRepository(InventoryMovement).findOne({
      where: { shop: { id: shopId }, clientOpId },
      relations: { item: true },
    });
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
      client_op_id: dto.client_op_id,
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
      occurred_at: mv.occurredAt ? mv.occurredAt.toISOString() : null,
      forced: mv.forced ?? false,
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

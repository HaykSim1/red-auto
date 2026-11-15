import { HttpStatus } from '@nestjs/common';
import { EntityManager, Not } from 'typeorm';
import { ApiException } from '../common/exceptions/api.exception';
import { InventoryItem } from '../database/entities/inventory-item.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { InventoryItemStatus, InventoryMovementType } from '../database/enums';

/**
 * The only code allowed to change inventory_items.quantity. Shared by
 * MovementsService and InventoryService (item create / legacy PATCH quantity)
 * as plain functions so neither service has to depend on the other.
 */

export const itemNotFound = () =>
  new ApiException(
    'inventory_item_not_found',
    'Inventory item not found.',
    HttpStatus.NOT_FOUND,
  );

export const insufficientStock = (available: number) =>
  new ApiException(
    'movement_insufficient_stock',
    'Not enough stock for this movement.',
    HttpStatus.BAD_REQUEST,
    { available },
  );

/**
 * Locks the item row for the rest of the transaction. No relations: Postgres
 * refuses FOR UPDATE on the nullable side of an outer join.
 */
export async function lockItem(
  m: EntityManager,
  shopId: string,
  id: string,
): Promise<InventoryItem> {
  const item = await m.getRepository(InventoryItem).findOne({
    where: {
      id,
      shop: { id: shopId },
      status: Not(InventoryItemStatus.ARCHIVED),
    },
    lock: { mode: 'pessimistic_write' },
  });
  if (!item) throw itemNotFound();
  return item;
}

/**
 * Signed delta for a request `quantity`. For `adjust` the quantity is the new
 * stock level; for every other type it is the positive amount moved.
 */
export function deltaFor(
  type: InventoryMovementType,
  quantity: number,
  stockBefore: number,
): number {
  if (type === InventoryMovementType.ADJUST) {
    const delta = quantity - stockBefore;
    if (delta === 0) {
      throw new ApiException(
        'movement_no_change',
        'Stock is already at this level.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return delta;
  }
  if (quantity < 1) {
    throw new ApiException(
      'validation_error',
      'quantity must be at least 1.',
      HttpStatus.BAD_REQUEST,
    );
  }
  return type === InventoryMovementType.RECEIVE ||
    type === InventoryMovementType.RETURN
    ? quantity
    : -quantity;
}

export interface RecordMovementArgs {
  shopId: string;
  userId: string;
  type: InventoryMovementType;
  delta: number;
  unitCost?: number | null;
  note?: string | null;
}

/**
 * Inserts a movement and writes the new stock (and, for a `receive` with a
 * cost, the item cost). `item` must have been locked by {@link lockItem} in
 * the same transaction, or be a row created in it. Mutates `item`.
 */
export async function recordMovement(
  m: EntityManager,
  item: InventoryItem,
  args: RecordMovementArgs,
): Promise<InventoryMovement> {
  const after = item.quantity + args.delta;
  if (after < 0) throw insufficientStock(item.quantity);

  const isReceive = args.type === InventoryMovementType.RECEIVE;
  const unitCost =
    isReceive && args.unitCost !== undefined && args.unitCost !== null
      ? String(args.unitCost)
      : null;

  const repo = m.getRepository(InventoryMovement);
  const movement = await repo.save(
    repo.create({
      shop: { id: args.shopId },
      item: { id: item.id },
      type: args.type,
      delta: args.delta,
      quantityAfter: after,
      unitCost,
      note: args.note?.trim() || null,
      createdBy: { id: args.userId },
    }),
  );

  const patch: Partial<InventoryItem> = { quantity: after };
  if (unitCost !== null) patch.costAmount = unitCost;
  await m.getRepository(InventoryItem).update({ id: item.id }, patch);
  Object.assign(item, patch);
  return movement;
}

import { EntityManager } from 'typeorm';
import { InventoryItem } from '../database/entities/inventory-item.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { InventoryMovementType as T } from '../database/enums';
import { deltaFor, recordMovement } from './movements';

describe('deltaFor', () => {
  it('receive and return add, sell and write_off subtract', () => {
    expect(deltaFor(T.RECEIVE, 10, 4)).toBe(10);
    expect(deltaFor(T.RETURN, 1, 4)).toBe(1);
    expect(deltaFor(T.SELL, 3, 4)).toBe(-3);
    expect(deltaFor(T.WRITE_OFF, 2, 4)).toBe(-2);
  });

  it('adjust takes the new stock level, in either direction', () => {
    expect(deltaFor(T.ADJUST, 7, 4)).toBe(3);
    expect(deltaFor(T.ADJUST, 0, 4)).toBe(-4);
  });

  it('adjust to the current level is movement_no_change', () => {
    expect(() => deltaFor(T.ADJUST, 4, 4)).toThrow(
      expect.objectContaining({ code: 'movement_no_change' }),
    );
  });

  it('a zero amount is rejected for every non-adjust type', () => {
    for (const t of [T.RECEIVE, T.RETURN, T.SELL, T.WRITE_OFF]) {
      expect(() => deltaFor(t, 0, 4)).toThrow(
        expect.objectContaining({ code: 'validation_error' }),
      );
    }
  });
});

describe('recordMovement', () => {
  let movementSaves: Partial<InventoryMovement>[];
  let itemUpdates: Partial<InventoryItem>[];
  let m: EntityManager;

  const item = (quantity: number) =>
    ({ id: 'item-1', quantity, costAmount: '900.00' }) as InventoryItem;
  const args = { shopId: 'shop-1', userId: 'user-1' };

  beforeEach(() => {
    movementSaves = [];
    itemUpdates = [];
    const movementRepo = {
      create: (v: Partial<InventoryMovement>) => v,
      save: (v: Partial<InventoryMovement>) => {
        movementSaves.push(v);
        return Promise.resolve({ id: 'mv-1', ...v });
      },
    };
    const itemRepo = {
      update: (_where: unknown, patch: Partial<InventoryItem>) => {
        itemUpdates.push(patch);
        return Promise.resolve({ affected: 1 });
      },
    };
    m = {
      getRepository: (e: unknown) =>
        e === InventoryMovement ? movementRepo : itemRepo,
    } as unknown as EntityManager;
  });

  it('writes the movement and the new stock together', async () => {
    const it = item(5);
    await recordMovement(m, it, { ...args, type: T.SELL, delta: -2 });
    expect(movementSaves[0]).toMatchObject({
      type: T.SELL,
      delta: -2,
      quantityAfter: 3,
      unitCost: null,
    });
    expect(itemUpdates[0]).toEqual({ quantity: 3 });
    expect(it.quantity).toBe(3);
  });

  it('refuses to take stock below zero and writes nothing', async () => {
    await expect(
      recordMovement(m, item(1), { ...args, type: T.SELL, delta: -2 }),
    ).rejects.toMatchObject({
      code: 'movement_insufficient_stock',
      details: { available: 1 },
    });
    expect(movementSaves).toHaveLength(0);
    expect(itemUpdates).toHaveLength(0);
  });

  it('a receive with a unit cost updates the item cost', async () => {
    await recordMovement(m, item(0), {
      ...args,
      type: T.RECEIVE,
      delta: 10,
      unitCost: 1200.5,
    });
    expect(movementSaves[0].unitCost).toBe('1200.5');
    expect(itemUpdates[0]).toEqual({ quantity: 10, costAmount: '1200.5' });
  });

  it('a unit cost on anything but receive is ignored', async () => {
    await recordMovement(m, item(5), {
      ...args,
      type: T.SELL,
      delta: -1,
      unitCost: 1,
    });
    expect(movementSaves[0].unitCost).toBeNull();
    expect(itemUpdates[0]).toEqual({ quantity: 4 });
  });
});

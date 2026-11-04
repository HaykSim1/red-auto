import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInventoryItemDto } from './create-inventory-item.dto';
import { UpdateInventoryItemDto } from './update-inventory-item.dto';

async function errorProps<T extends object>(
  cls: new () => T,
  plain: object,
): Promise<string[]> {
  const errs = await validate(plainToInstance(cls, plain));
  return errs.map((e) => e.property);
}

describe('inventory DTO null handling', () => {
  it('create rejects null for non-nullable fields', async () => {
    expect(
      await errorProps(CreateInventoryItemDto, { name: 'x', quantity: null }),
    ).toContain('quantity');
    expect(
      await errorProps(CreateInventoryItemDto, { name: 'x', fitments: null }),
    ).toContain('fitments');
    expect(
      await errorProps(CreateInventoryItemDto, { name: 'x', condition: null }),
    ).toContain('condition');
    expect(
      await errorProps(CreateInventoryItemDto, { name: 'x', status: null }),
    ).toContain('status');
  });

  it('update rejects name: null and other non-nullable nulls', async () => {
    expect(await errorProps(UpdateInventoryItemDto, { name: null })).toContain(
      'name',
    );
    expect(
      await errorProps(UpdateInventoryItemDto, { quantity: null }),
    ).toContain('quantity');
    expect(
      await errorProps(UpdateInventoryItemDto, { photo_storage_keys: null }),
    ).toContain('photo_storage_keys');
    expect(
      await errorProps(UpdateInventoryItemDto, { oem_numbers: null }),
    ).toContain('oem_numbers');
  });

  it('nullable fields accept null; omitted fields are fine', async () => {
    expect(
      await errorProps(CreateInventoryItemDto, {
        name: 'x',
        brand: null,
        price_amount: null,
        note: null,
        fitments: [{ make: 'Toyota', model: null, year_from: null }],
      }),
    ).toEqual([]);
    expect(await errorProps(UpdateInventoryItemDto, { brand: null })).toEqual(
      [],
    );
    expect(await errorProps(UpdateInventoryItemDto, {})).toEqual([]);
  });

  it('photo_storage_keys entries are length-limited', async () => {
    expect(
      await errorProps(CreateInventoryItemDto, {
        name: 'x',
        photo_storage_keys: ['a'.repeat(301)],
      }),
    ).toContain('photo_storage_keys');
  });

  it('price_amount is capped at 9 999 999 999', async () => {
    expect(
      await errorProps(CreateInventoryItemDto, {
        name: 'x',
        price_amount: 10_000_000_000,
      }),
    ).toContain('price_amount');
    expect(
      await errorProps(UpdateInventoryItemDto, { price_amount: 9_999_999_999 }),
    ).toEqual([]);
  });
});

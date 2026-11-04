import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListInventoryItemsQueryDto } from './list-inventory-items-query.dto';

async function parse(plain: object) {
  const dto = plainToInstance(ListInventoryItemsQueryDto, plain, {
    enableImplicitConversion: true,
  });
  return { dto, errors: await validate(dto) };
}

describe('ListInventoryItemsQueryDto in_stock (implicit conversion)', () => {
  it('"false" -> false', async () => {
    const { dto, errors } = await parse({ in_stock: 'false' });
    expect(errors).toHaveLength(0);
    expect(dto.in_stock).toBe(false);
  });

  it('"true" -> true', async () => {
    const { dto, errors } = await parse({ in_stock: 'true' });
    expect(errors).toHaveLength(0);
    expect(dto.in_stock).toBe(true);
  });

  it('absent -> undefined', async () => {
    const { dto, errors } = await parse({});
    expect(errors).toHaveLength(0);
    expect(dto.in_stock).toBeUndefined();
  });

  it('unrecognised value -> isBoolean validation error', async () => {
    const { errors } = await parse({ in_stock: 'maybe' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isBoolean');
  });

  it('array value -> isBoolean validation error', async () => {
    const { errors } = await parse({ in_stock: ['true', 'false'] });
    expect(errors[0]?.constraints).toHaveProperty('isBoolean');
  });
});

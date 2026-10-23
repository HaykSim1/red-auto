import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRequestDto } from './create-request.dto';
import { PatchRequestDto } from './patch-request.dto';

async function createErrors(vin_text: unknown) {
  return validate(
    plainToInstance(CreateRequestDto, { description: 'Brake pads', vin_text }),
  );
}

describe('vin_text format', () => {
  it('accepts a well-formed 17-character VIN', async () => {
    expect(await createErrors('WBA3A5C58CF123456')).toHaveLength(0);
  });

  it('accepts an omitted, null or empty vin_text', async () => {
    expect(await createErrors(undefined)).toHaveLength(0);
    expect(await createErrors(null)).toHaveLength(0);
    expect(await createErrors('')).toHaveLength(0);
  });

  it('rejects a VIN that is too short or contains I, O or Q', async () => {
    for (const bad of ['WBA3A5C58CF12345', 'WBA3A5C58CF12345I', 'ABC']) {
      const errors = await createErrors(bad);
      expect(errors.map((e) => e.property)).toEqual(['vin_text']);
    }
  });

  it('applies the same rule on PATCH', async () => {
    const errors = await validate(
      plainToInstance(PatchRequestDto, { vin_text: 'TOO-SHORT' }),
    );
    expect(errors.map((e) => e.property)).toEqual(['vin_text']);
  });
});

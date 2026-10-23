import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOperatorDto } from './create-operator.dto';

const valid = {
  email: 'op@red-auto.local',
  password: 'correct-horse',
  display_name: 'Ani',
  phone: '+37491000555',
};

async function errorsFor(body: Record<string, unknown>) {
  return validate(plainToInstance(CreateOperatorDto, body));
}

describe('CreateOperatorDto', () => {
  it('accepts a well-formed body', async () => {
    expect(await errorsFor(valid)).toHaveLength(0);
  });

  it('rejects a whitespace-only display_name', async () => {
    const errors = await errorsFor({ ...valid, display_name: '   ' });
    expect(errors.map((e) => e.property)).toEqual(['display_name']);
  });
});

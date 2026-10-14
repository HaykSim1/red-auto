import { operatorSeedSpec } from './seed-operator';

describe('operatorSeedSpec', () => {
  it('returns null when SEED_OPERATOR is not requested', () => {
    expect(
      operatorSeedSpec({ SEED_OPERATOR_EMAIL: 'op@red-auto.local' }),
    ).toBeNull();
  });

  it('refuses to seed an operator without an explicit strong password', () => {
    expect(() =>
      operatorSeedSpec({
        SEED_OPERATOR: 'true',
        SEED_OPERATOR_EMAIL: 'op@red-auto.local',
      }),
    ).toThrow(/SEED_OPERATOR_PASSWORD/);
    expect(() =>
      operatorSeedSpec({
        SEED_OPERATOR: 'true',
        SEED_OPERATOR_EMAIL: 'op@red-auto.local',
        SEED_OPERATOR_PASSWORD: 'short',
      }),
    ).toThrow(/at least 8/);
  });

  it('builds the operator spec from explicit env values', () => {
    expect(
      operatorSeedSpec({
        SEED_OPERATOR: 'true',
        SEED_OPERATOR_EMAIL: 'Op@Red-Auto.local ',
        SEED_OPERATOR_PASSWORD: 'correct-horse',
        SEED_OPERATOR_PHONE: '+37400000002',
      }),
    ).toEqual({
      email: 'op@red-auto.local',
      password: 'correct-horse',
      phone: '+37400000002',
    });
  });
});

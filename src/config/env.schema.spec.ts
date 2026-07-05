import { validateEnv } from './env.schema';

const baseEnv = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_SECRET: 'a-secret-of-16-chars-min',
};

describe('env.schema — SMS_PROVIDER=wings', () => {
  it('accepts wings in development without wings vars', () => {
    const env = validateEnv({
      ...baseEnv,
      NODE_ENV: 'development',
      SMS_PROVIDER: 'wings',
    });
    expect(env.SMS_PROVIDER).toBe('wings');
  });

  it('rejects wings in production without credentials', () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        SMS_PROVIDER: 'wings',
      }),
    ).toThrow(/SMS_WINGS_BASE_URL/);
  });

  it('accepts wings in production with all required vars', () => {
    const env = validateEnv({
      ...baseEnv,
      NODE_ENV: 'production',
      SMS_PROVIDER: 'wings',
      SMS_WINGS_BASE_URL: 'https://smssend.nikita.am/broker-api',
      SMS_WINGS_USERNAME: 'user',
      SMS_WINGS_PASSWORD: 'pass',
      SMS_WINGS_ORIGINATOR: 'RedAuto',
    });
    expect(env.SMS_PROVIDER).toBe('wings');
    expect(env.SMS_WINGS_ORIGINATOR).toBe('RedAuto');
  });

  it('coerces SMS_WINGS_TTL to a positive integer', () => {
    const env = validateEnv({
      ...baseEnv,
      SMS_WINGS_TTL: '300',
    });
    expect(env.SMS_WINGS_TTL).toBe(300);
  });
});

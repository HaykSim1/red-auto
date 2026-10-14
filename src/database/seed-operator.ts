/**
 * Operator (staff) seed spec from env. Pure so it can be unit-tested; the seed
 * script hashes the password and upserts the row.
 *
 * Requires an explicit `SEED_OPERATOR_PASSWORD` (min 8 chars): a staff login on
 * the unthrottled admin login endpoint must never fall back to a default.
 */
export type OperatorSeedSpec = {
  email: string;
  password: string;
  phone: string;
};

export function operatorSeedSpec(
  env: Record<string, string | undefined>,
): OperatorSeedSpec | null {
  if (env.SEED_OPERATOR !== 'true') return null;
  const email = env.SEED_OPERATOR_EMAIL?.trim().toLowerCase();
  if (!email)
    throw new Error('SEED_OPERATOR=true requires SEED_OPERATOR_EMAIL.');
  const password = env.SEED_OPERATOR_PASSWORD;
  if (!password) {
    throw new Error(
      'SEED_OPERATOR=true requires an explicit SEED_OPERATOR_PASSWORD (no default).',
    );
  }
  if (password.length < 8) {
    throw new Error('SEED_OPERATOR_PASSWORD must be at least 8 characters.');
  }
  return { email, password, phone: env.SEED_OPERATOR_PHONE ?? '+37400000002' };
}

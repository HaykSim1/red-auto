import { resolve } from 'node:path';
import { config } from 'dotenv';

config({ path: resolve(__dirname, '../.env') });

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://zapchast:zapchast@127.0.0.1:5433/zapchast';
}

process.env.JWT_SECRET ??=
  'e2e-test-jwt-secret-min-16-chars';
process.env.NODE_ENV ??= 'test';

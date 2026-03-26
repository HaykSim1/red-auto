import 'dotenv/config';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { typeOrmEntities } from './entities';

const migrationExt = __filename.endsWith('.js') ? 'js' : 'ts';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [...typeOrmEntities],
  migrations: [join(__dirname, 'migrations', `*.${migrationExt}`)],
  migrationsTableName: 'typeorm_migrations',
  /** Required so migrations may set `transaction = false` (e.g. PG enum ADD VALUE). */
  migrationsTransactionMode: 'each',
});

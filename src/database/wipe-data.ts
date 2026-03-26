/**
 * Deletes all application data. Schema and migration history are kept.
 * Usage: from api/: npm run db:wipe
 */
import dataSource from './data-source';

async function wipe(): Promise<void> {
  await dataSource.initialize();

  const rows: { tablename: string }[] = await dataSource.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('typeorm_migrations')
    ORDER BY tablename;
  `);

  if (rows.length === 0) {
    // eslint-disable-next-line no-console
    console.log('No tables to truncate.');
    await dataSource.destroy();
    return;
  }

  const list = rows
    .map((r) => `"${String(r.tablename).replace(/"/g, '""')}"`)
    .join(', ');
  await dataSource.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);

  // eslint-disable-next-line no-console
  console.log(`Truncated ${rows.length} table(s). Migration history unchanged.`);
  await dataSource.destroy();
}

wipe().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

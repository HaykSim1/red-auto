import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One VIN per user in the garage.
 *
 * 1. Normalize stored VINs the way the API now writes them (uppercase, no spaces/dashes).
 * 2. Merge duplicates per (user_id, vin): keep the oldest row, re-point part_requests from the
 *    newer copies to it, delete the copies.
 * 3. Partial unique index so a concurrent insert cannot sneak a duplicate past the service check.
 */
export class UniqueVehicleVinPerUser1777500000000 implements MigrationInterface {
  name = 'UniqueVehicleVinPerUser1777500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Normalize. Rows whose VIN becomes empty must already satisfy the brand/model/year check
    // constraint, otherwise leave them untouched (they keep their odd VIN and stay unique).
    await queryRunner.query(`
      UPDATE "vehicles"
      SET "vin" = NULLIF(upper(regexp_replace("vin", '[\\s-]', '', 'g')), '')
      WHERE "vin" IS NOT NULL
        AND (
          NULLIF(upper(regexp_replace("vin", '[\\s-]', '', 'g')), '') IS NOT NULL
          OR ("brand" IS NOT NULL AND "model" IS NOT NULL AND "year" IS NOT NULL)
        )
    `);

    // Merge duplicates: keeper = oldest row per (user_id, vin).
    await queryRunner.query(`
      CREATE TEMP TABLE "vehicle_vin_dupes" ON COMMIT DROP AS
      WITH ranked AS (
        SELECT "id", "user_id", "vin",
               first_value("id") OVER (
                 PARTITION BY "user_id", "vin" ORDER BY "created_at" ASC, "id" ASC
               ) AS "keeper_id",
               row_number() OVER (
                 PARTITION BY "user_id", "vin" ORDER BY "created_at" ASC, "id" ASC
               ) AS "rn"
        FROM "vehicles"
        WHERE "vin" IS NOT NULL
      )
      SELECT "id" AS "dupe_id", "keeper_id" FROM ranked WHERE "rn" > 1
    `);
    await queryRunner.query(`
      UPDATE "part_requests" pr
      SET "vehicle_id" = d."keeper_id"
      FROM "vehicle_vin_dupes" d
      WHERE pr."vehicle_id" = d."dupe_id"
    `);
    await queryRunner.query(`
      DELETE FROM "vehicles" v USING "vehicle_vin_dupes" d WHERE v."id" = d."dupe_id"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_vehicles_user_vin" ON "vehicles" ("user_id", "vin") WHERE "vin" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Merged duplicate rows are gone for good; only the index is reverted.
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_vehicles_user_vin"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Offline sell / receive: a client-generated operation id makes a movement
 * idempotent, `occurred_at` keeps the device time, `forced` marks a sale that
 * was applied although stock was insufficient. The item index is read by
 * `updated_at` for delta sync.
 */
export class InventoryOfflineOperations1780000000000 implements MigrationInterface {
  name = 'InventoryOfflineOperations1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" ADD "client_op_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" ADD "occurred_at" TIMESTAMPTZ(3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" ADD "forced" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_inventory_movements_shop_client_op" ON "inventory_movements" ("shop_id", "client_op_id") WHERE "client_op_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_items_shop_updated" ON "inventory_items" ("shop_id", "updated_at", "id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_inventory_items_shop_updated"`);
    await queryRunner.query(
      `DROP INDEX "UQ_inventory_movements_shop_client_op"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" DROP COLUMN "forced"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" DROP COLUMN "occurred_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" DROP COLUMN "client_op_id"`,
    );
  }
}

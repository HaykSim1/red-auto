import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Search also matches name_en / name_hy (ILIKE substring, needs trigram
 * indexes), and item photos are always loaded ordered per item.
 * pg_trgm is created by InventoryItems1778000000000.
 */
export class InventorySearchIndexes1778100000000 implements MigrationInterface {
  name = 'InventorySearchIndexes1778100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_items_name_en_trgm" ON "inventory_items" USING gin ("name_en" gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_items_name_hy_trgm" ON "inventory_items" USING gin ("name_hy" gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_item_photos_item_sort" ON "inventory_item_photos" ("item_id", "sort_order")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_inventory_item_photos_item_sort"`);
    await queryRunner.query(`DROP INDEX "IDX_inventory_items_name_hy_trgm"`);
    await queryRunner.query(`DROP INDEX "IDX_inventory_items_name_en_trgm"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stock movements (the only write path for inventory_items.quantity), shop
 * suppliers, and cost price / supplier on items. Existing stock gets one
 * opening `adjust` movement per item so every history starts consistent.
 */
export class InventoryMovementsAndSuppliers1779000000000 implements MigrationInterface {
  name = 'InventoryMovementsAndSuppliers1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "inventory_movement_type_enum" AS ENUM ('receive', 'sell', 'write_off', 'return', 'adjust')`,
    );

    await queryRunner.query(`
      CREATE TABLE "inventory_suppliers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "shop_id" uuid NOT NULL,
        "name" text NOT NULL,
        "phone" text,
        "telegram" text,
        "note" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_inventory_suppliers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_inventory_suppliers_shop_id" FOREIGN KEY ("shop_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_inventory_suppliers_shop_name" ON "inventory_suppliers" ("shop_id", lower("name")) WHERE "deleted_at" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "inventory_items" ADD "cost_amount" numeric(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" ADD "supplier_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" ADD CONSTRAINT "FK_inventory_items_supplier_id" FOREIGN KEY ("supplier_id") REFERENCES "inventory_suppliers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_items_supplier" ON "inventory_items" ("supplier_id") WHERE "supplier_id" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "inventory_movements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "shop_id" uuid NOT NULL,
        "item_id" uuid NOT NULL,
        "type" "inventory_movement_type_enum" NOT NULL,
        "delta" integer NOT NULL,
        "quantity_after" integer NOT NULL,
        "unit_cost" numeric(12,2),
        "note" text,
        "created_by_user_id" uuid,
        "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inventory_movements" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_inventory_movements_delta" CHECK ("delta" <> 0),
        CONSTRAINT "CHK_inventory_movements_quantity_after" CHECK ("quantity_after" >= 0),
        CONSTRAINT "FK_inventory_movements_shop_id" FOREIGN KEY ("shop_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_inventory_movements_item_id" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_inventory_movements_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_movements_item_created" ON "inventory_movements" ("item_id", "created_at", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_movements_shop_created" ON "inventory_movements" ("shop_id", "created_at", "id")`,
    );

    await queryRunner.query(`
      INSERT INTO "inventory_movements"
        ("shop_id", "item_id", "type", "delta", "quantity_after", "note", "created_by_user_id")
      SELECT "shop_id", "id", 'adjust', "quantity", "quantity", 'initial', "shop_id"
      FROM "inventory_items"
      WHERE "quantity" > 0 AND "status" <> 'archived'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "inventory_movements"`);
    await queryRunner.query(`DROP INDEX "IDX_inventory_items_supplier"`);
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP CONSTRAINT "FK_inventory_items_supplier_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP COLUMN "supplier_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP COLUMN "cost_amount"`,
    );
    await queryRunner.query(`DROP INDEX "UQ_inventory_suppliers_shop_name"`);
    await queryRunner.query(`DROP TABLE "inventory_suppliers"`);
    await queryRunner.query(`DROP TYPE "inventory_movement_type_enum"`);
  }
}

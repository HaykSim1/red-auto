import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shop inventory: items, item photos and AI recognition jobs.
 * Reuses the existing "offer_condition_enum" type for inventory_items.condition.
 */
export class InventoryItems1778000000000 implements MigrationInterface {
  name = 'InventoryItems1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(
      `CREATE TYPE "inventory_item_status_enum" AS ENUM ('draft', 'active', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TYPE "inventory_recognition_status_enum" AS ENUM ('pending', 'processing', 'done', 'failed')`,
    );

    await queryRunner.query(`
      CREATE TABLE "inventory_recognitions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "shop_id" uuid NOT NULL,
        "status" "inventory_recognition_status_enum" NOT NULL DEFAULT 'pending',
        "photo_storage_keys" text[] NOT NULL DEFAULT '{}',
        "barcode_hint" text,
        "text_hint" text,
        "result" jsonb,
        "possible_duplicate_item_id" uuid,
        "error_code" text,
        "error_message" text,
        "model" text,
        "input_tokens" integer,
        "output_tokens" integer,
        "web_search_uses" integer,
        "duration_ms" integer,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "finished_at" TIMESTAMPTZ,
        CONSTRAINT "PK_inventory_recognitions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_inventory_recognitions_shop_id" FOREIGN KEY ("shop_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_recognitions_shop_created" ON "inventory_recognitions" ("shop_id", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "inventory_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "shop_id" uuid NOT NULL,
        "status" "inventory_item_status_enum" NOT NULL DEFAULT 'draft',
        "brand" text,
        "part_number" text,
        "part_number_normalized" text,
        "barcode" text,
        "oem_numbers" text[] NOT NULL DEFAULT '{}',
        "name" text NOT NULL,
        "name_hy" text,
        "name_en" text,
        "category_key" text,
        "fitments" jsonb NOT NULL DEFAULT '[]',
        "fitment_note" text,
        "condition" "offer_condition_enum" NOT NULL DEFAULT 'new',
        "price_amount" numeric(12,2),
        "price_currency" text NOT NULL DEFAULT 'AMD',
        "quantity" integer NOT NULL DEFAULT 1,
        "shelf_location" text,
        "note" text,
        "ai_confidence" jsonb,
        "needs_review" text[] NOT NULL DEFAULT '{}',
        "recognition_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_inventory_items" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_inventory_items_quantity" CHECK ("quantity" >= 0),
        CONSTRAINT "FK_inventory_items_shop_id" FOREIGN KEY ("shop_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_inventory_items_recognition_id" FOREIGN KEY ("recognition_id") REFERENCES "inventory_recognitions"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_items_shop_status" ON "inventory_items" ("shop_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_items_shop_pn" ON "inventory_items" ("shop_id", "part_number_normalized")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_items_shop_barcode" ON "inventory_items" ("shop_id", "barcode")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_items_name_trgm" ON "inventory_items" USING gin ("name" gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_items_pn_trgm" ON "inventory_items" USING gin ("part_number_normalized" gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_items_oem" ON "inventory_items" USING gin ("oem_numbers")`,
    );

    await queryRunner.query(`
      CREATE TABLE "inventory_item_photos" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "item_id" uuid NOT NULL,
        "storage_key" text NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_inventory_item_photos" PRIMARY KEY ("id"),
        CONSTRAINT "FK_inventory_item_photos_item_id" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "inventory_item_photos"`);
    await queryRunner.query(`DROP INDEX "IDX_inventory_items_oem"`);
    await queryRunner.query(`DROP INDEX "IDX_inventory_items_pn_trgm"`);
    await queryRunner.query(`DROP INDEX "IDX_inventory_items_name_trgm"`);
    await queryRunner.query(`DROP INDEX "IDX_inventory_items_shop_barcode"`);
    await queryRunner.query(`DROP INDEX "IDX_inventory_items_shop_pn"`);
    await queryRunner.query(`DROP INDEX "IDX_inventory_items_shop_status"`);
    await queryRunner.query(`DROP TABLE "inventory_items"`);
    await queryRunner.query(
      `DROP INDEX "IDX_inventory_recognitions_shop_created"`,
    );
    await queryRunner.query(`DROP TABLE "inventory_recognitions"`);
    await queryRunner.query(`DROP TYPE "inventory_recognition_status_enum"`);
    await queryRunner.query(`DROP TYPE "inventory_item_status_enum"`);
  }
}

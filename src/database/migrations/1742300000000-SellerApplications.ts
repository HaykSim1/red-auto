import { MigrationInterface, QueryRunner } from 'typeorm';

export class SellerApplications1742300000000 implements MigrationInterface {
  name = 'SellerApplications1742300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "seller_application_status_enum" AS ENUM ('pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(`
      CREATE TABLE "seller_applications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "status" "seller_application_status_enum" NOT NULL DEFAULT 'pending',
        "shop_name" text NOT NULL,
        "shop_address" text NOT NULL,
        "shop_phone" text NOT NULL,
        "logo_storage_key" text,
        "rejection_reason" text,
        "reviewed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_seller_applications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_seller_applications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_seller_applications_user_id" ON "seller_applications" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_seller_applications_status" ON "seller_applications" ("status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_seller_applications_one_pending_per_user" ON "seller_applications" ("user_id") WHERE ("status" = 'pending')`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "shop_name" text`);
    await queryRunner.query(`ALTER TABLE "users" ADD "shop_address" text`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "shop_logo_storage_key" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "shop_logo_storage_key"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "shop_address"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "shop_name"`);
    await queryRunner.query(
      `DROP INDEX "UQ_seller_applications_one_pending_per_user"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_seller_applications_status"`);
    await queryRunner.query(`DROP INDEX "IDX_seller_applications_user_id"`);
    await queryRunner.query(`DROP TABLE "seller_applications"`);
    await queryRunner.query(`DROP TYPE "seller_application_status_enum"`);
  }
}

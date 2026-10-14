import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Managed shop personas (operated by staff) and offer creation audit.
 * - users.is_managed_shop: admin-created seller persona; no OTP login.
 * - offers.created_by_user_id: staff user who actually created the offer.
 */
export class ManagedShopsAndOfferCreatedBy1777700000000 implements MigrationInterface {
  name = 'ManagedShopsAndOfferCreatedBy1777700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "is_managed_shop" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD "created_by_user_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD CONSTRAINT "FK_offers_created_by_user_id" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_offers_created_by_user_id" ON "offers" ("created_by_user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_offers_created_by_user_id"`);
    await queryRunner.query(
      `ALTER TABLE "offers" DROP CONSTRAINT "FK_offers_created_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP COLUMN "created_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "is_managed_shop"`,
    );
  }
}

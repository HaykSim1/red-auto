import { MigrationInterface, QueryRunner } from 'typeorm';

export class OfferAcceptanceFlow1742200000000 implements MigrationInterface {
  name = 'OfferAcceptanceFlow1742200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "offer_interaction_state_enum" AS ENUM ('none', 'contact_revealed', 'buyer_cancelled', 'deal_completed', 'superseded')`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD "interaction_state" "offer_interaction_state_enum" NOT NULL DEFAULT 'none'`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD "buyer_accepted_at" TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD "buyer_cancel_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD "buyer_cancelled_at" TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD "seller_acknowledged_at" TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "part_requests" ADD "active_acceptance_offer_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "part_requests" ADD CONSTRAINT "FK_part_requests_active_offer" FOREIGN KEY ("active_acceptance_offer_id") REFERENCES "offers"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_offers_seller_interaction" ON "offers" ("seller_id", "interaction_state")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_offers_seller_interaction"`);
    await queryRunner.query(
      `ALTER TABLE "part_requests" DROP CONSTRAINT "FK_part_requests_active_offer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "part_requests" DROP COLUMN "active_acceptance_offer_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP COLUMN "seller_acknowledged_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP COLUMN "buyer_cancelled_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP COLUMN "buyer_cancel_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP COLUMN "buyer_accepted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP COLUMN "interaction_state"`,
    );
    await queryRunner.query(`DROP TYPE "offer_interaction_state_enum"`);
  }
}

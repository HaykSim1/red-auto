import { MigrationInterface, QueryRunner } from 'typeorm';

export class MutualDealCompletion1742400000000 implements MigrationInterface {
  name = 'MutualDealCompletion1742400000000';

  /** PG: ADD VALUE cannot run inside a transaction on older servers; safest without txn. */
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "offer_interaction_state_enum" ADD VALUE 'mutually_cancelled'`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD "buyer_deal_complete_at" TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD "seller_deal_complete_at" TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD "buyer_deal_cancel_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD "buyer_deal_cancel_at" TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD "seller_deal_cancel_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD "seller_deal_cancel_at" TIMESTAMPTZ`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "offers" DROP COLUMN "seller_deal_cancel_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP COLUMN "seller_deal_cancel_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP COLUMN "buyer_deal_cancel_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP COLUMN "buyer_deal_cancel_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP COLUMN "seller_deal_complete_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP COLUMN "buyer_deal_complete_at"`,
    );
    // Postgres: cannot remove enum value easily; leave 'mutually_cancelled' on type
  }
}

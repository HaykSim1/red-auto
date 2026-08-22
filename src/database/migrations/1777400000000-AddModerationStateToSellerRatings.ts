import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModerationStateToSellerRatings1777400000000 implements MigrationInterface {
  name = 'AddModerationStateToSellerRatings1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Reuses the existing shared enum type; does NOT create a new one.
    await queryRunner.query(
      `ALTER TABLE "seller_ratings" ADD COLUMN "moderation_state" "moderation_state_enum" NOT NULL DEFAULT 'visible'`,
    );
    // seller_ratings has an FK on seller_id but no index; Postgres does not
    // create one automatically. refreshAggregate now runs on every moderation
    // change as well as every new rating, and the per-shop list filters by it.
    await queryRunner.query(
      `CREATE INDEX "IDX_seller_ratings_seller" ON "seller_ratings" ("seller_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Deliberately does NOT drop "moderation_state_enum": part_requests and
    // offers both use that type, and dropping it would take their columns too.
    await queryRunner.query(`DROP INDEX "IDX_seller_ratings_seller"`);
    await queryRunner.query(
      `ALTER TABLE "seller_ratings" DROP COLUMN "moderation_state"`,
    );
  }
}

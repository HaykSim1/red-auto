import { MigrationInterface, QueryRunner } from 'typeorm';

export class OpenRatings1777307442237 implements MigrationInterface {
  name = 'OpenRatings1777307442237';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old unique constraint (request_id, rater_id)
    await queryRunner.query(
      `ALTER TABLE "seller_ratings" DROP CONSTRAINT IF EXISTS "UQ_seller_ratings_request_rater"`,
    );

    // Make request_id nullable (historical rows keep their value)
    await queryRunner.query(
      `ALTER TABLE "seller_ratings" ALTER COLUMN "request_id" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "seller_ratings" ALTER COLUMN "request_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_ratings" ADD CONSTRAINT "UQ_seller_ratings_request_rater" UNIQUE ("request_id", "rater_id")`,
    );
  }
}

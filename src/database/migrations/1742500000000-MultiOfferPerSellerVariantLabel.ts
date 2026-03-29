import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiOfferPerSellerVariantLabel1742500000000
  implements MigrationInterface
{
  name = 'MultiOfferPerSellerVariantLabel1742500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "offers" DROP CONSTRAINT IF EXISTS "UQ_offers_request_seller"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD "variant_label" text NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "offers" DROP COLUMN "variant_label"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD CONSTRAINT "UQ_offers_request_seller" UNIQUE ("request_id", "seller_id")`,
    );
  }
}

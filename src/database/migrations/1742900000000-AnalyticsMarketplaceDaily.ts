import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnalyticsMarketplaceDaily1742900000000 implements MigrationInterface {
  name = 'AnalyticsMarketplaceDaily1742900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "analytics_marketplace_daily" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "bucket_date" date NOT NULL,
        "region" text NOT NULL,
        "requests_created" integer NOT NULL DEFAULT 0,
        "offers_created" integer NOT NULL DEFAULT 0,
        "requests_with_offer" integer NOT NULL DEFAULT 0,
        "requests_with_selection" integer NOT NULL DEFAULT 0,
        "sum_sec_to_first_offer" bigint NOT NULL DEFAULT 0,
        "n_sec_to_first_offer" integer NOT NULL DEFAULT 0,
        "median_sec_to_first_offer" numeric(20,4),
        "sum_sec_first_offer_to_selection" bigint NOT NULL DEFAULT 0,
        "n_sec_first_offer_to_selection" integer NOT NULL DEFAULT 0,
        "active_sellers" integer NOT NULL DEFAULT 0,
        "ratings_submitted" integer NOT NULL DEFAULT 0,
        "requests_with_photo" integer NOT NULL DEFAULT 0,
        "requests_with_vehicle" integer NOT NULL DEFAULT 0,
        "vin_entered_requests" integer NOT NULL DEFAULT 0,
        "vehicles_created" integer NOT NULL DEFAULT 0,
        "distinct_vehicle_owners" integer NOT NULL DEFAULT 0,
        "computed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_analytics_marketplace_daily" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_analytics_marketplace_daily_bucket_region" UNIQUE ("bucket_date", "region")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_marketplace_daily_bucket" ON "analytics_marketplace_daily" ("bucket_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "analytics_marketplace_daily"`);
  }
}

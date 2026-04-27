import { MigrationInterface, QueryRunner } from 'typeorm';

export class HomeBanners1742800000000 implements MigrationInterface {
  name = 'HomeBanners1742800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "home_banners" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "storage_key" text NOT NULL,
        "title" text NOT NULL,
        "subtitle" text,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_home_banners" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "home_banners"`);
  }
}

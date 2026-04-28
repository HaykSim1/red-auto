import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppVersionConfig1747400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "app_version_config" (
        "platform"               VARCHAR(16)  NOT NULL,
        "min_build"              INTEGER      NOT NULL DEFAULT 0,
        "store_url"              TEXT,
        "force_update_enabled"   BOOLEAN      NOT NULL DEFAULT false,
        "updated_at"             TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_version_config" PRIMARY KEY ("platform")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "app_version_config" ("platform", "min_build", "store_url", "force_update_enabled")
      VALUES ('ios', 0, NULL, false), ('android', 0, NULL, false)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "app_version_config"`);
  }
}

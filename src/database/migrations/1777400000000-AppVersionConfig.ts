import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppVersionConfig1777400000000 implements MigrationInterface {
  name = 'AppVersionConfig1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "app_version_config" (
        "platform"              VARCHAR(16)  NOT NULL,
        "min_build"             INT          NOT NULL DEFAULT 0,
        "latest_build"          INT          NOT NULL DEFAULT 0,
        "store_url"             TEXT,
        "force_update_enabled"  BOOLEAN      NOT NULL DEFAULT FALSE,
        "updated_at"            TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_version_config_platform" PRIMARY KEY ("platform")
      )
    `);

    // Seed default rows so the table is never empty
    await queryRunner.query(`
      INSERT INTO "app_version_config" ("platform") VALUES ('ios'), ('android')
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "app_version_config"`);
  }
}

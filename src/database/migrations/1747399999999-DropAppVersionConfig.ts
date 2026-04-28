import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropAppVersionConfig1747399999999 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "app_version_config"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // no-op: the following migration recreates the table
  }
}

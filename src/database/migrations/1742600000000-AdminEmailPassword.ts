import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminEmailPassword1742600000000 implements MigrationInterface {
  name = 'AdminEmailPassword1742600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_users_email" UNIQUE ("email")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password_hash" text NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "password_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_users_email"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "email"`,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOperatorUserRole1777600000000 implements MigrationInterface {
  name = 'AddOperatorUserRole1777600000000';

  /** PG: ADD VALUE cannot run inside a transaction on older servers; safest without txn. */
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "user_role_enum" ADD VALUE IF NOT EXISTS 'operator'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL cannot remove enum values safely; leave as no-op.
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSellerUserRole1742100000000 implements MigrationInterface {
  name = 'AddSellerUserRole1742100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "user_role_enum" ADD VALUE 'seller'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL cannot remove enum values safely; leave as no-op.
  }
}

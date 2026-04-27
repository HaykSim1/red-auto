import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsFeaturedToUsers1742700000000 implements MigrationInterface {
  name = 'AddIsFeaturedToUsers1742700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "is_featured" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_featured"`);
  }
}

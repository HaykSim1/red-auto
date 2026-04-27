import { MigrationInterface, QueryRunner } from 'typeorm';

export class SpecialBuyerFlag1743000000000 implements MigrationInterface {
  name = 'SpecialBuyerFlag1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "is_special_buyer" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_special_buyer"`);
  }
}

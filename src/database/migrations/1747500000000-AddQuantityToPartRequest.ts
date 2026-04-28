import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuantityToPartRequest1747500000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "part_requests" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "part_requests" DROP COLUMN "quantity"`,
    );
  }
}

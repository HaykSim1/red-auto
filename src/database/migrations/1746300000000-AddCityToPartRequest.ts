import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCityToPartRequest1746300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "part_requests" ADD COLUMN "city" VARCHAR(100) NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "part_requests" DROP COLUMN "city"`,
    );
  }
}

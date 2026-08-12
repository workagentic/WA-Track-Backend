import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveStatusFromTasks1755000000005 implements MigrationInterface {
  name = 'RemoveStatusFromTasks1755000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "status"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" ADD COLUMN "status" varchar NOT NULL DEFAULT 'open'`);
  }
}

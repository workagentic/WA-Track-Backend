import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveDueDateFromTasks1755000000011 implements MigrationInterface {
  name = 'RemoveDueDateFromTasks1755000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "dueDate"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" ADD COLUMN "dueDate" date`);
  }
}

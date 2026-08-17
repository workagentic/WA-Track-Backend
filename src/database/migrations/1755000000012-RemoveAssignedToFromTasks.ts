import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveAssignedToFromTasks1755000000012 implements MigrationInterface {
  name = 'RemoveAssignedToFromTasks1755000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_assignedTo"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "assignedToId"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" ADD COLUMN "assignedToId" integer`);
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_assignedTo" FOREIGN KEY ("assignedToId") REFERENCES "employees"("id") ON DELETE RESTRICT`,
    );
  }
}

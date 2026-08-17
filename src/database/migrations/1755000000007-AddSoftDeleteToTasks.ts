import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteToTasks1755000000007 implements MigrationInterface {
  name = 'AddSoftDeleteToTasks1755000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" ADD COLUMN "deletedAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD COLUMN "deletedById" integer`);
    await queryRunner.query(`
      ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_deletedBy"
      FOREIGN KEY ("deletedById") REFERENCES "employees"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`CREATE INDEX "IDX_tasks_deletedAt" ON "tasks" ("deletedAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_deletedAt"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_deletedBy"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "deletedById"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "deletedAt"`);
  }
}

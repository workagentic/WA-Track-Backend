import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientIdToTasks1755000000006 implements MigrationInterface {
  name = 'AddClientIdToTasks1755000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" ADD COLUMN "clientId" integer`);
    await queryRunner.query(`
      ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_client"
      FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`CREATE INDEX "IDX_tasks_client" ON "tasks" ("clientId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_client"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_client"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "clientId"`);
  }
}

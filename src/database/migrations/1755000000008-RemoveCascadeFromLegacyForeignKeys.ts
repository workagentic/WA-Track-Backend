import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveCascadeFromLegacyForeignKeys1755000000008 implements MigrationInterface {
  name = 'RemoveCascadeFromLegacyForeignKeys1755000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_department"`);
    await queryRunner.query(`
      ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_department"
      FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`ALTER TABLE "time_entries" DROP CONSTRAINT "FK_time_entries_employee"`);
    await queryRunner.query(`
      ALTER TABLE "time_entries" ADD CONSTRAINT "FK_time_entries_employee"
      FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`ALTER TABLE "time_entries" DROP CONSTRAINT "FK_time_entries_task"`);
    await queryRunner.query(`
      ALTER TABLE "time_entries" ADD CONSTRAINT "FK_time_entries_task"
      FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`ALTER TABLE "device_sessions" DROP CONSTRAINT "FK_device_sessions_employee"`);
    await queryRunner.query(`
      ALTER TABLE "device_sessions" ADD CONSTRAINT "FK_device_sessions_employee"
      FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "device_sessions" DROP CONSTRAINT "FK_device_sessions_employee"`);
    await queryRunner.query(`
      ALTER TABLE "device_sessions" ADD CONSTRAINT "FK_device_sessions_employee"
      FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`ALTER TABLE "time_entries" DROP CONSTRAINT "FK_time_entries_task"`);
    await queryRunner.query(`
      ALTER TABLE "time_entries" ADD CONSTRAINT "FK_time_entries_task"
      FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`ALTER TABLE "time_entries" DROP CONSTRAINT "FK_time_entries_employee"`);
    await queryRunner.query(`
      ALTER TABLE "time_entries" ADD CONSTRAINT "FK_time_entries_employee"
      FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_department"`);
    await queryRunner.query(`
      ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_department"
      FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE
    `);
  }
}

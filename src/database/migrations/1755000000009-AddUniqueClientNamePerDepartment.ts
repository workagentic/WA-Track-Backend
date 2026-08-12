import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueClientNamePerDepartment1755000000009 implements MigrationInterface {
  name = 'AddUniqueClientNamePerDepartment1755000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Partial (deletedAt IS NULL) so a soft-deleted client's name can be reused
    // in the same department, matching the pattern used for employees.email/username.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_clients_name_department_active"
      ON "clients" ("name", "departmentId")
      WHERE "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_clients_name_department_active"`);
  }
}

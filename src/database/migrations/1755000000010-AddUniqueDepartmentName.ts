import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueDepartmentName1755000000010 implements MigrationInterface {
  name = 'AddUniqueDepartmentName1755000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Partial (deletedAt IS NULL) so a soft-deleted department's name can be
    // reused by a new department, matching the employees.email/username and
    // clients name+department pattern.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_departments_name_active" ON "departments" ("name") WHERE "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_departments_name_active"`);
  }
}

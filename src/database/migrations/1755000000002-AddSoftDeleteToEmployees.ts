import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteToEmployees1755000000002 implements MigrationInterface {
  name = 'AddSoftDeleteToEmployees1755000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "employees" ADD COLUMN "deletedAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "employees" ADD COLUMN "deletedById" integer`);
    await queryRunner.query(`
      ALTER TABLE "employees" ADD CONSTRAINT "FK_employees_deletedBy"
      FOREIGN KEY ("deletedById") REFERENCES "employees"("id") ON DELETE SET NULL
    `);

    // Convert email + username to partial unique indexes so a soft-deleted
    // employee's email/username can be reused by a new hire.
    await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "employees_email_key"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_employees_email_active" ON "employees" ("email") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "UQ_employees_username"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_employees_username_active" ON "employees" ("username") WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(`CREATE INDEX "IDX_employees_deletedAt" ON "employees" ("deletedAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_employees_deletedAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_employees_username_active"`);
    await queryRunner.query(
      `ALTER TABLE "employees" ADD CONSTRAINT "UQ_employees_username" UNIQUE ("username")`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_employees_email_active"`);
    await queryRunner.query(
      `ALTER TABLE "employees" ADD CONSTRAINT "employees_email_key" UNIQUE ("email")`,
    );
    await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "FK_employees_deletedBy"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "deletedById"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "deletedAt"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteToDepartments1755000000003 implements MigrationInterface {
  name = 'AddSoftDeleteToDepartments1755000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "departments" ADD COLUMN "deletedAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "departments" ADD COLUMN "deletedById" integer`);
    await queryRunner.query(`
      ALTER TABLE "departments" ADD CONSTRAINT "FK_departments_deletedBy"
      FOREIGN KEY ("deletedById") REFERENCES "employees"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`CREATE INDEX "IDX_departments_deletedAt" ON "departments" ("deletedAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_departments_deletedAt"`);
    await queryRunner.query(`ALTER TABLE "departments" DROP CONSTRAINT "FK_departments_deletedBy"`);
    await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN "deletedById"`);
    await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN "deletedAt"`);
  }
}

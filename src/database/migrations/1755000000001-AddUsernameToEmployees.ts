import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsernameToEmployees1755000000001 implements MigrationInterface {
  name = 'AddUsernameToEmployees1755000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "employees" ADD COLUMN "username" varchar`);
    await queryRunner.query(`UPDATE "employees" SET "username" = 'user_' || "id" WHERE "username" IS NULL`);
    await queryRunner.query(`ALTER TABLE "employees" ALTER COLUMN "username" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "employees" ADD CONSTRAINT "UQ_employees_username" UNIQUE ("username")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "UQ_employees_username"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "username"`);
  }
}

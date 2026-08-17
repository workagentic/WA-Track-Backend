import { MigrationInterface, QueryRunner } from 'typeorm';

// employees already has createdAt (InitSchema); clients already has both
// (CreateClientsTable) — this migration fills in every remaining gap so
// every table can be ordered "newest first" consistently.
export class AddCreatedAtUpdatedAtToAllTables1755000000013 implements MigrationInterface {
  name = 'AddCreatedAtUpdatedAtToAllTables1755000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "employees" ADD COLUMN "updatedAt" timestamptz NOT NULL DEFAULT now()`);

    await queryRunner.query(`ALTER TABLE "departments" ADD COLUMN "createdAt" timestamptz NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "departments" ADD COLUMN "updatedAt" timestamptz NOT NULL DEFAULT now()`);

    await queryRunner.query(`ALTER TABLE "tasks" ADD COLUMN "createdAt" timestamptz NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD COLUMN "updatedAt" timestamptz NOT NULL DEFAULT now()`);

    await queryRunner.query(`ALTER TABLE "time_entries" ADD COLUMN "createdAt" timestamptz NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "time_entries" ADD COLUMN "updatedAt" timestamptz NOT NULL DEFAULT now()`);

    await queryRunner.query(`ALTER TABLE "device_sessions" ADD COLUMN "createdAt" timestamptz NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "device_sessions" ADD COLUMN "updatedAt" timestamptz NOT NULL DEFAULT now()`);

    await queryRunner.query(`ALTER TABLE "pairing_codes" ADD COLUMN "createdAt" timestamptz NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "pairing_codes" ADD COLUMN "updatedAt" timestamptz NOT NULL DEFAULT now()`);

    await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "createdAt" timestamptz NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "updatedAt" timestamptz NOT NULL DEFAULT now()`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN "createdAt"`);

    await queryRunner.query(`ALTER TABLE "pairing_codes" DROP COLUMN "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "pairing_codes" DROP COLUMN "createdAt"`);

    await queryRunner.query(`ALTER TABLE "device_sessions" DROP COLUMN "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "device_sessions" DROP COLUMN "createdAt"`);

    await queryRunner.query(`ALTER TABLE "time_entries" DROP COLUMN "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "time_entries" DROP COLUMN "createdAt"`);

    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "createdAt"`);

    await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN "createdAt"`);

    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "updatedAt"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClientsTable1755000000004 implements MigrationInterface {
  name = 'CreateClientsTable1755000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "clients" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar NOT NULL,
        "description" text,
        "departmentId" integer NOT NULL,
        "createdById" integer NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz,
        "deletedById" integer,
        CONSTRAINT "FK_clients_department" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_clients_createdBy" FOREIGN KEY ("createdById") REFERENCES "employees"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_clients_deletedBy" FOREIGN KEY ("deletedById") REFERENCES "employees"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_clients_department" ON "clients" ("departmentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_clients_createdBy" ON "clients" ("createdById")`);
    await queryRunner.query(`CREATE INDEX "IDX_clients_deletedAt" ON "clients" ("deletedAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "clients"`);
  }
}

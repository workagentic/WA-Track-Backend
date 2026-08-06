import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1735500000000 implements MigrationInterface {
  name = 'InitSchema1735500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar NOT NULL UNIQUE,
        "permissions" text
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "departments" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar NOT NULL,
        "headEmployeeId" integer
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "employees" (
        "id" SERIAL PRIMARY KEY,
        "fullName" varchar NOT NULL,
        "email" varchar NOT NULL UNIQUE,
        "passwordHash" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'active',
        "departmentId" integer,
        "roleId" integer NOT NULL,
        "manager_id" integer,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_employees_department" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_employees_role" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_employees_manager" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id" SERIAL PRIMARY KEY,
        "title" varchar NOT NULL,
        "description" text,
        "status" varchar NOT NULL DEFAULT 'open',
        "dueDate" date,
        "departmentId" integer NOT NULL,
        "assignedToId" integer NOT NULL,
        "createdById" integer NOT NULL,
        CONSTRAINT "FK_tasks_department" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tasks_assignedTo" FOREIGN KEY ("assignedToId") REFERENCES "employees"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_tasks_createdBy" FOREIGN KEY ("createdById") REFERENCES "employees"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "time_entries" (
        "id" SERIAL PRIMARY KEY,
        "employeeId" integer NOT NULL,
        "taskId" integer NOT NULL,
        "startTime" timestamptz NOT NULL,
        "endTime" timestamptz,
        "durationSeconds" integer NOT NULL DEFAULT 0,
        "syncStatus" varchar NOT NULL DEFAULT 'pending',
        "lastHeartbeat" timestamptz,
        "localId" varchar NOT NULL UNIQUE,
        CONSTRAINT "FK_time_entries_employee" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_time_entries_task" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "device_sessions" (
        "id" SERIAL PRIMARY KEY,
        "employeeId" integer NOT NULL,
        "deviceFingerprint" varchar NOT NULL,
        "refreshTokenHash" varchar NOT NULL,
        "lastActive" timestamptz,
        "isActive" boolean NOT NULL DEFAULT true,
        CONSTRAINT "FK_device_sessions_employee" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "pairing_codes" (
        "id" SERIAL PRIMARY KEY,
        "deviceCode" varchar NOT NULL UNIQUE,
        "userCode" varchar NOT NULL UNIQUE,
        "employeeId" integer,
        "status" varchar NOT NULL DEFAULT 'pending',
        "expiresAt" timestamptz NOT NULL,
        "lastPolledAt" timestamptz,
        "pollIntervalSeconds" integer NOT NULL DEFAULT 5,
        "deviceSessionId" integer,
        CONSTRAINT "FK_pairing_codes_employee" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_tasks_department" ON "tasks" ("departmentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_time_entries_employee" ON "time_entries" ("employeeId")`);
    await queryRunner.query(`CREATE INDEX "IDX_time_entries_task" ON "time_entries" ("taskId")`);
    await queryRunner.query(`CREATE INDEX "IDX_device_sessions_employee" ON "device_sessions" ("employeeId")`);
    await queryRunner.query(`CREATE INDEX "IDX_pairing_codes_status" ON "pairing_codes" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "pairing_codes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "device_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "time_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tasks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "employees"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "departments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
  }
}

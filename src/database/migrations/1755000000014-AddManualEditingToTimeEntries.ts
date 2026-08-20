import { MigrationInterface, QueryRunner } from 'typeorm';

// Backs HR's ability to manually create/correct a time entry. manuallyEdited
// is the flag time-entries.service.ts's sync() checks to refuse overwriting
// an HR correction from a later desktop-app sync of the same localId — see
// TIME_ENTRY_AUDIT_MECHANICS.md for the full reasoning.
export class AddManualEditingToTimeEntries1755000000014 implements MigrationInterface {
  name = 'AddManualEditingToTimeEntries1755000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "time_entries" ADD COLUMN "manuallyEdited" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "time_entries" ADD COLUMN "editedById" integer`);
    await queryRunner.query(`ALTER TABLE "time_entries" ADD COLUMN "editedAt" timestamptz`);
    await queryRunner.query(`
      ALTER TABLE "time_entries" ADD CONSTRAINT "FK_time_entries_editedBy"
      FOREIGN KEY ("editedById") REFERENCES "employees"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "time_entry_audits" (
        "id" SERIAL PRIMARY KEY,
        "timeEntryId" integer NOT NULL,
        "editedById" integer NOT NULL,
        "editedAt" timestamptz NOT NULL DEFAULT now(),
        "previousDurationSeconds" integer NOT NULL,
        "newDurationSeconds" integer NOT NULL,
        "reason" character varying,
        CONSTRAINT "FK_time_entry_audits_timeEntry" FOREIGN KEY ("timeEntryId") REFERENCES "time_entries"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_time_entry_audits_editedBy" FOREIGN KEY ("editedById") REFERENCES "employees"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_time_entry_audits_timeEntry" ON "time_entry_audits" ("timeEntryId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_time_entry_audits_timeEntry"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "time_entry_audits"`);

    await queryRunner.query(`ALTER TABLE "time_entries" DROP CONSTRAINT "FK_time_entries_editedBy"`);
    await queryRunner.query(`ALTER TABLE "time_entries" DROP COLUMN "editedAt"`);
    await queryRunner.query(`ALTER TABLE "time_entries" DROP COLUMN "editedById"`);
    await queryRunner.query(`ALTER TABLE "time_entries" DROP COLUMN "manuallyEdited"`);
  }
}

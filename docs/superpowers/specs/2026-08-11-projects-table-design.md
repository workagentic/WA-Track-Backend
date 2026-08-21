# Projects Table — Design Spec

Date: 2026-08-11

## Purpose

Introduce a `projects` table so that tasks can be grouped under a project.
One project has many tasks (one-to-many). This is a schema-only change:
migration + entity + relation wiring, no API/controller/service layer.

## Data model

### `projects` (new table)

| Column | Type | Constraint |
|---|---|---|
| `id` | `SERIAL` | PRIMARY KEY |
| `name` | `varchar` | NOT NULL |
| `description` | `text` | nullable |
| `departmentId` | `integer` | NOT NULL, FK → `departments(id)` ON DELETE RESTRICT |
| `createdAt` | `timestamptz` | NOT NULL DEFAULT `now()` |

No status column (explicitly excluded — no open/closed/archived concept on
projects).

### `tasks` (altered)

Add:

| Column | Type | Constraint |
|---|---|---|
| `projectId` | `integer` | NOT NULL, FK → `projects(id)` |

The existing `tasks.status` column (`open | in_progress | done | archived`)
is untouched — the "remove status" requirement applies only to the new
`projects` table, not to `tasks`.

**Assumption**: the migration adds `projectId` as `NOT NULL` with no
backfill step. This is safe only if the `tasks` table is empty when the
migration runs (dev/pre-launch state). If `tasks` already has rows at
migration time, Postgres will reject the NOT NULL column addition. This
tradeoff was chosen deliberately (dev-only assumption) instead of
auto-creating a fallback "Unassigned" project to backfill existing rows.

## Migration

New file: `src/database/migrations/<timestamp>-CreateProjects.ts`, following
the raw-SQL style of the existing `InitSchema1735500000000` migration
(`src/database/migrations/1735500000000-InitSchema.ts`):

- `up()`:
  1. `CREATE TABLE "projects" (...)` per the schema above, with
     `FK_projects_department`.
  2. `ALTER TABLE "tasks" ADD COLUMN "projectId" integer NOT NULL`.
  3. `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_project" FOREIGN KEY
     ("projectId") REFERENCES "projects"("id")`.
  4. `CREATE INDEX "IDX_projects_department" ON "projects" ("departmentId")`
     and `CREATE INDEX "IDX_tasks_project" ON "tasks" ("projectId")`,
     matching the indexing pattern already used for other FK columns in
     `InitSchema`.
- `down()`: drop `FK_tasks_project` + `tasks.projectId` column, then drop
  the `projects` table.

## Entity + relation wiring

- New `src/projects/project.entity.ts`, mirroring the style of
  `src/departments/department.entity.ts`:
  - `id`, `name`, `description`, `@ManyToOne(() => Department) department`,
    `@OneToMany(() => Task, (t) => t.project) tasks`, `@CreateDateColumn()
    createdAt`.
- `src/tasks/task.entity.ts` gains:
  `@ManyToOne(() => Project, (p) => p.tasks) project!: Project;`
- New minimal `src/projects/projects.module.ts`:
  `@Module({ imports: [TypeOrmModule.forFeature([Project])] })` — no
  controller/service/DTOs. This module's sole purpose is registering the
  `Project` entity so `autoLoadEntities: true` (set in `app.module.ts:30`)
  picks it up; nothing else does this automatically.
- `ProjectsModule` added to the `imports` array in `src/app.module.ts`.

## Explicitly out of scope

- No `ProjectsController`/`ProjectsService`/DTOs — no REST endpoints for
  projects in this change.
- No changes to `tasks.service.ts`/`tasks.controller.ts` beyond what TypeORM
  requires for the new relation to compile (no new query logic, no
  project-scoping added to existing task queries).
- No backfill/data-migration logic for pre-existing `tasks` rows.

## ERD

A Mermaid ER diagram covering the complete current schema (`roles`,
`departments`, `employees`, `tasks`, `projects`, `time_entries`,
`device_sessions`, `pairing_codes`), published as an artifact, showing the
new `projects ||--o{ tasks` relationship alongside existing relations.

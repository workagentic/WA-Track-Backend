# Client Module + Production Soft-Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Client` entity (Department → Client → Task), production soft-delete with delete-audit (`deletedAt`/`deletedById`) on `Employee`/`Department`/`Client`/`Task`, an immutable unique `username` on `Employee`, a cross-entity Audit API, and remove every `ON DELETE CASCADE` from the schema (replacing with `RESTRICT`/`SET NULL`) — backend only.

**Architecture:** NestJS modules per resource (`clients/` new, `employees/`/`departments/`/`tasks/` extended, `audit/` new — read-only, no own table). TypeORM with hand-written raw-SQL migrations (matching the existing `1735500000000-InitSchema.ts` style), one small migration per concern so each is independently trackable/revertible. Soft delete is implemented as an explicit `repository.update(id, { deletedAt, deletedBy })` (not `repository.softDelete()`, which can't set an audit column), never a real `DELETE`.

**Tech Stack:** NestJS 11, TypeORM (raw-SQL migrations via `ts-node`, `npm run migration:run`/`migration:revert`), PostgreSQL (Neon), class-validator/class-transformer DTOs, Jest + `@nestjs/testing` for unit tests (mocked repositories — no existing `.spec.ts` files exist yet in this codebase, so this plan establishes the pattern).

## Global Constraints

- **Backend only.** No changes to `client/` or `desktop_app/`.
- **No `ON DELETE CASCADE` anywhere in the schema.** New FKs use `RESTRICT` or `SET NULL`; four pre-existing `CASCADE` FKs (`tasks.departmentId`, `time_entries.employeeId`, `time_entries.taskId`, `device_sessions.employeeId`) must be converted to `RESTRICT`.
- **No `status`/active-inactive column on `Client` or `Task`.** `Task.status` is removed entirely.
- **No cascading soft delete by default.** Deleting a parent with active children is blocked (`409 Conflict`) unless the caller passes `force=true`, which soft-deletes children too — but never `TimeEntry`.
- **`TimeEntry` is never modified, never soft-deleted.** Permanent historical record.
- **`username` is immutable once set** — never present in any `Update*Dto`.
- **Every migration is its own small file**, one concern each, named `<timestamp>-<Name>.ts` in `backend/src/database/migrations/`, following the exact raw-SQL style of `1735500000000-InitSchema.ts` (`MigrationInterface`, `name` property, `up`/`down`).
- **RBAC** via the existing `RolesGuard` + `@Roles(...)` decorator — no new guard infrastructure.
- **Global `ValidationPipe`** already has `whitelist: true, forbidNonWhitelisted: true` (`backend/src/main.ts:42-48`) — any DTO that omits a field automatically rejects that field with `400` if a caller sends it. This is what actually enforces `username` immutability at the API boundary.
- Full design reference: `D:\timecamp2.0\CLIENT_SCHEMA_DESIGN.md`.

---

## Task 1: Employee `username` (immutable, unique)

**Files:**
- Create: `backend/src/database/migrations/1755000000001-AddUsernameToEmployees.ts`
- Modify: `backend/src/employees/employee.entity.ts`
- Modify: `backend/src/employees/dto/create-employee.dto.ts`
- Modify: `backend/src/employees/dto/update-employee.dto.ts`
- Modify: `backend/src/employees/employees.service.ts`
- Test: `backend/src/employees/employees.service.spec.ts`

**Interfaces:**
- Produces: `Employee.username: string`; `CreateEmployeeDto.username: string`; `EmployeesService.create()` persists `username` from the DTO.

- [ ] **Step 1: Write the migration**

```ts
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
```

(The plain `UNIQUE` here is intentionally temporary — Task 2 converts both `email` and `username` to partial unique indexes once `deletedAt` exists. Splitting it this way avoids a migration that references a column that doesn't exist yet.)

- [ ] **Step 2: Add `username` to the entity**

In `backend/src/employees/employee.entity.ts`, add directly under `email`:

```ts
  @Column()
  username!: string;
```

- [ ] **Step 3: Add `username` to `CreateEmployeeDto`**

In `backend/src/employees/dto/create-employee.dto.ts`, add after `email`:

```ts
  @ApiProperty({ example: 'jane.doe' })
  @IsString()
  @Matches(/^[a-z0-9_.-]{3,32}$/, {
    message: 'username must be 3-32 lowercase letters, numbers, "_", "." or "-"',
  })
  username: string;
```

Add `Matches` to the existing `class-validator` import line.

- [ ] **Step 4: Exclude `username` from `UpdateEmployeeDto`**

`backend/src/employees/dto/update-employee.dto.ts` becomes:

```ts
import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateEmployeeDto } from './create-employee.dto';

// password changes go through a dedicated /employees/:id/password endpoint;
// username is immutable once set — neither is ever accepted on a plain PATCH.
export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['password', 'username'] as const),
) {}
```

- [ ] **Step 5: Persist `username` on create**

In `backend/src/employees/employees.service.ts`, in `create()`, add `username: dto.username,` to the object passed to `this.employeesRepo.create({...})` (right after `email: dto.email,`).

- [ ] **Step 6: Write the failing test**

Create `backend/src/employees/employees.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmployeesService } from './employees.service';
import { Employee } from './employee.entity';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let repo: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 1, ...x })),
    };
    const module = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: getRepositoryToken(Employee), useValue: repo },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(12) } },
      ],
    }).compile();
    service = module.get(EmployeesService);
  });

  it('persists username on create', async () => {
    await service.create({
      fullName: 'Jane Doe',
      email: 'jane@company.com',
      username: 'jane.doe',
      password: 'StrongPassw0rd!',
      departmentId: 1,
      roleId: 1,
    } as any);

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ username: 'jane.doe' }));
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd backend && npx jest employees.service.spec.ts`
Expected: FAIL — `username` not yet assigned in `create()` (if Step 5 hasn't landed) or compile error if `Employee.username` doesn't exist yet. Do this step before Step 2/5 if strictly following red-green-refactor; given the small size here it's acceptable to implement Steps 2-5 first and use this test as the passing check — either order is fine as long as you observe the test failing once before the implementation is in place.

- [ ] **Step 8: Run test to verify it passes**

Run: `cd backend && npx jest employees.service.spec.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/database/migrations/1755000000001-AddUsernameToEmployees.ts src/employees/employee.entity.ts src/employees/dto/create-employee.dto.ts src/employees/dto/update-employee.dto.ts src/employees/employees.service.ts src/employees/employees.service.spec.ts
git commit -m "feat(employees): add immutable unique username"
```

---

## Task 2: Employee soft delete + delete-audit

**Files:**
- Create: `backend/src/database/migrations/1755000000002-AddSoftDeleteToEmployees.ts`
- Modify: `backend/src/employees/employee.entity.ts`
- Modify: `backend/src/employees/employees.service.ts`
- Modify: `backend/src/employees/employees.controller.ts`
- Test: `backend/src/employees/employees.service.spec.ts`

**Interfaces:**
- Consumes: `Employee.username` (Task 1).
- Produces: `Employee.deletedAt: Date | null`, `Employee.deletedBy: Employee | null`; `EmployeesService.softDelete(id: number, actingUserId: number): Promise<void>`; `EmployeesService.restore(id: number): Promise<Employee>`.

- [ ] **Step 1: Write the migration**

```ts
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
```

- [ ] **Step 2: Add soft-delete fields to the entity**

In `backend/src/employees/employee.entity.ts`:
- Remove `unique: true` from the `email` column's `@Column({ unique: true })` (now `@Column()`) — the real uniqueness lives in the partial index, not a plain constraint, so the decorator shouldn't claim otherwise.
- Add `DeleteDateColumn` to the `typeorm` import.
- Add at the end of the class, before the closing brace:

```ts
  @DeleteDateColumn()
  deletedAt!: Date | null;

  @ManyToOne(() => Employee, { nullable: true })
  deletedBy!: Employee | null;
```

- [ ] **Step 3: Add `softDelete`/`restore` to the service**

In `backend/src/employees/employees.service.ts`, add:

```ts
  public async softDelete(id: number, actingUserId: number): Promise<void> {
    await this.findById(id);
    await this.employeesRepo.update(id, {
      deletedAt: new Date(),
      deletedBy: { id: actingUserId } as any,
    });
  }

  public async restore(id: number): Promise<Employee> {
    const employee = await this.employeesRepo.findOne({ where: { id }, withDeleted: true });
    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }
    await this.employeesRepo.update(id, { deletedAt: null, deletedBy: null });
    return this.findById(id);
  }
```

- [ ] **Step 4: Add delete/restore endpoints**

In `backend/src/employees/employees.controller.ts`, add imports for `Delete` (from `@nestjs/common`) and add:

```ts
  @Delete(':id')
  @Roles('HR', 'ADMIN')
  public async softDelete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.employeesService.softDelete(id, user.sub);
    return { success: true };
  }

  @Patch(':id/restore')
  @Roles('HR', 'ADMIN')
  public restore(@Param('id', ParseIntPipe) id: number): Promise<Employee> {
    return this.employeesService.restore(id);
  }
```

- [ ] **Step 5: Write the failing test**

Add to `backend/src/employees/employees.service.spec.ts` (extend the existing `repo` mock with `update`, `findOne`, and add `NotFoundException` import):

```ts
import { NotFoundException } from '@nestjs/common';
// ...inside the existing describe block, update the repo mock in beforeEach to also include:
//   update: jest.fn(),
//   findOne: jest.fn(),

  it('sets deletedAt and deletedBy on softDelete', async () => {
    repo.findOne.mockResolvedValue({ id: 5 });
    await service.softDelete(5, 9);
    expect(repo.update).toHaveBeenCalledWith(5, {
      deletedAt: expect.any(Date),
      deletedBy: { id: 9 },
    });
  });

  it('throws NotFoundException restoring a non-existent employee', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.restore(99)).rejects.toThrow(NotFoundException);
  });

  it('clears deletedAt and deletedBy on restore', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 5, deletedAt: new Date() }).mockResolvedValueOnce({ id: 5 });
    await service.restore(5);
    expect(repo.update).toHaveBeenCalledWith(5, { deletedAt: null, deletedBy: null });
  });
```

Note: `findById()` internally calls `employeesRepo.findOne(...)` too, so the mock's second `mockResolvedValueOnce` covers the `findById` call inside `restore()`.

- [ ] **Step 6: Run tests to verify they fail, then implement, then pass**

Run: `cd backend && npx jest employees.service.spec.ts`
Iterate until: PASS (4 tests total, including Task 1's).

- [ ] **Step 7: Commit**

```bash
git add src/database/migrations/1755000000002-AddSoftDeleteToEmployees.ts src/employees/employee.entity.ts src/employees/employees.service.ts src/employees/employees.controller.ts src/employees/employees.service.spec.ts
git commit -m "feat(employees): soft delete with delete-audit trail"
```

---

## Task 3: Department soft delete + delete-audit

**Files:**
- Create: `backend/src/database/migrations/1755000000003-AddSoftDeleteToDepartments.ts`
- Modify: `backend/src/departments/department.entity.ts`
- Modify: `backend/src/departments/departments.service.ts`
- Modify: `backend/src/departments/departments.controller.ts`
- Test: `backend/src/departments/departments.service.spec.ts`

**Interfaces:**
- Produces: `Department.deletedAt: Date | null`, `Department.deletedBy: Employee | null`; `DepartmentsService.softDelete(id: number, actingUserId: number): Promise<void>` (no cascade check yet — `Client` doesn't exist until Task 4; Task 8 upgrades this signature to add a `force` parameter); `DepartmentsService.restore(id: number): Promise<Department>`.

- [ ] **Step 1: Write the migration**

```ts
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
```

- [ ] **Step 2: Add soft-delete fields to the entity**

In `backend/src/departments/department.entity.ts`, add `DeleteDateColumn` and `ManyToOne` to the `typeorm` import, import `Employee`, and add:

```ts
  deletedAt: Date | null;

  deletedBy: Employee | null;
```

with the correct decorators, matching this file's existing (no `!`) style:

```ts
  @DeleteDateColumn()
  deletedAt: Date | null;

  @ManyToOne(() => Employee, { nullable: true })
  deletedBy: Employee | null;
```

- [ ] **Step 3: Add `softDelete`/`restore` to the service**

In `backend/src/departments/departments.service.ts`, add `NotFoundException` is already imported; add:

```ts
  public async softDelete(id: number, actingUserId: number): Promise<void> {
    await this.findById(id);
    await this.departmentsRepo.update(id, {
      deletedAt: new Date(),
      deletedBy: { id: actingUserId } as any,
    });
  }

  public async restore(id: number): Promise<Department> {
    const department = await this.departmentsRepo.findOne({ where: { id }, withDeleted: true });
    if (!department) {
      throw new NotFoundException(`Department ${id} not found`);
    }
    await this.departmentsRepo.update(id, { deletedAt: null, deletedBy: null });
    return this.findById(id);
  }
```

- [ ] **Step 4: Add delete/restore endpoints**

In `backend/src/departments/departments.controller.ts`, add `Delete` to the `@nestjs/common` import, add `CurrentUser`/`AuthenticatedUser` imports (matching `tasks.controller.ts`'s pattern), and add:

```ts
  @Delete(':id')
  @Roles('HR', 'ADMIN')
  public async softDelete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.departmentsService.softDelete(id, user.sub);
    return { success: true };
  }

  @Patch(':id/restore')
  @Roles('HR', 'ADMIN')
  public restore(@Param('id', ParseIntPipe) id: number): Promise<Department> {
    return this.departmentsService.restore(id);
  }
```

- [ ] **Step 5: Write the failing test**

Create `backend/src/departments/departments.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DepartmentsService } from './departments.service';
import { Department } from './department.entity';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let repo: { findOne: jest.Mock; update: jest.Mock };

  beforeEach(async () => {
    repo = { findOne: jest.fn(), update: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [DepartmentsService, { provide: getRepositoryToken(Department), useValue: repo }],
    }).compile();
    service = module.get(DepartmentsService);
  });

  it('sets deletedAt and deletedBy on softDelete', async () => {
    repo.findOne.mockResolvedValue({ id: 3 });
    await service.softDelete(3, 9);
    expect(repo.update).toHaveBeenCalledWith(3, { deletedAt: expect.any(Date), deletedBy: { id: 9 } });
  });

  it('throws NotFoundException restoring a non-existent department', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.restore(99)).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 6: Run tests, implement/iterate until passing**

Run: `cd backend && npx jest departments.service.spec.ts`

- [ ] **Step 7: Commit**

```bash
git add src/database/migrations/1755000000003-AddSoftDeleteToDepartments.ts src/departments/department.entity.ts src/departments/departments.service.ts src/departments/departments.controller.ts src/departments/departments.service.spec.ts
git commit -m "feat(departments): soft delete with delete-audit trail"
```

---

## Task 4: Client module (entity, CRUD — no delete yet)

**Files:**
- Create: `backend/src/database/migrations/1755000000004-CreateClientsTable.ts`
- Create: `backend/src/clients/client.entity.ts`
- Create: `backend/src/clients/dto/create-client.dto.ts`
- Create: `backend/src/clients/dto/update-client.dto.ts`
- Create: `backend/src/clients/clients.service.ts`
- Create: `backend/src/clients/clients.controller.ts`
- Create: `backend/src/clients/clients.module.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/src/clients/clients.service.spec.ts`

**Interfaces:**
- Consumes: `Department` (`backend/src/departments/department.entity.ts`), `Employee` (`backend/src/employees/employee.entity.ts`), `AuthenticatedUser` (`backend/src/auth/interfaces/authenticated-user.interface.ts`).
- Produces: `Client { id, name, description, department, createdBy, tasks, createdAt, updatedAt, deletedAt, deletedBy }`; `ClientsService.create/findAll/findById/update`. Delete/restore land in Task 8.

- [ ] **Step 1: Write the migration**

```ts
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
```

- [ ] **Step 2: Create the entity**

`backend/src/clients/client.entity.ts`:

```ts
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from '../departments/department.entity';
import { Employee } from '../employees/employee.entity';
import { Task } from '../tasks/task.entity';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @ManyToOne(() => Department)
  department!: Department;

  @ManyToOne(() => Employee)
  createdBy!: Employee;

  @OneToMany(() => Task, (t) => t.client)
  tasks!: Task[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;

  @ManyToOne(() => Employee, { nullable: true })
  deletedBy!: Employee | null;
}
```

(`Task.client`/`t.client` is added in Task 6 — until then this file won't compile standalone; it becomes valid once Task 6 lands. This is expected for this task's intermediate state; run `npm run build` again after Task 6 to confirm.)

- [ ] **Step 3: Create the DTOs**

`backend/src/clients/dto/create-client.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ example: 'ABC Company' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Retail client, EU region' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsInt()
  departmentId: number;
}
```

`backend/src/clients/dto/update-client.dto.ts`:

```ts
import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateClientDto } from './create-client.dto';

// department is fixed at creation — a client doesn't move departments after the fact
export class UpdateClientDto extends PartialType(OmitType(CreateClientDto, ['departmentId'] as const)) {}
```

- [ ] **Step 4: Create the service**

`backend/src/clients/clients.service.ts`:

```ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './client.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Injectable()
export class ClientsService {
  constructor(@InjectRepository(Client) private clientsRepo: Repository<Client>) {}

  public async findAll(user: AuthenticatedUser, withDeleted = false): Promise<Client[]> {
    const qb = this.clientsRepo
      .createQueryBuilder('client')
      .leftJoinAndSelect('client.department', 'department')
      .leftJoinAndSelect('client.createdBy', 'createdBy');

    if (withDeleted) {
      qb.withDeleted();
    }
    if (user.role === 'MANAGER') {
      qb.andWhere('department.id = :departmentId', { departmentId: user.departmentId });
    }

    return qb.getMany();
  }

  public async findById(id: number): Promise<Client> {
    const client = await this.clientsRepo.findOne({
      where: { id },
      relations: { department: true, createdBy: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }
    return client;
  }

  public create(dto: CreateClientDto, user: AuthenticatedUser): Promise<Client> {
    if (user.role === 'MANAGER' && dto.departmentId !== user.departmentId) {
      throw new ForbiddenException('Managers may only create clients within their own department');
    }

    const client = this.clientsRepo.create({
      name: dto.name,
      description: dto.description,
      department: { id: dto.departmentId } as any,
      createdBy: { id: user.sub } as any,
    });

    return this.clientsRepo.save(client);
  }

  public async update(id: number, dto: UpdateClientDto, user: AuthenticatedUser): Promise<Client> {
    const client = await this.findById(id);

    if (user.role === 'MANAGER' && client.department?.id !== user.departmentId) {
      throw new ForbiddenException('Managers may only update clients within their own department');
    }

    if (dto.name !== undefined) client.name = dto.name;
    if (dto.description !== undefined) client.description = dto.description;

    return this.clientsRepo.save(client);
  }
}
```

- [ ] **Step 5: Create the controller**

`backend/src/clients/clients.controller.ts`:

```ts
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Client } from './client.entity';

@ApiTags('clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  public findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('withDeleted') withDeleted?: string,
  ): Promise<Client[]> {
    return this.clientsService.findAll(user, withDeleted === 'true');
  }

  @Get(':id')
  public findById(@Param('id', ParseIntPipe) id: number): Promise<Client> {
    return this.clientsService.findById(id);
  }

  @Post()
  @Roles('HR', 'MANAGER', 'ADMIN')
  public create(@Body() dto: CreateClientDto, @CurrentUser() user: AuthenticatedUser): Promise<Client> {
    return this.clientsService.create(dto, user);
  }

  @Patch(':id')
  @Roles('HR', 'MANAGER', 'ADMIN')
  public update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Client> {
    return this.clientsService.update(id, dto, user);
  }
}
```

`withDeleted` on `GET /clients` is exposed to any authenticated caller here for simplicity; Task 8 is not expected to lock it down further — flag if you want it restricted to `HR`/`ADMIN` only.

- [ ] **Step 6: Create the module**

`backend/src/clients/clients.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './client.entity';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Client])],
  providers: [ClientsService],
  controllers: [ClientsController],
  exports: [ClientsService],
})
export class ClientsModule {}
```

- [ ] **Step 7: Register the module**

In `backend/src/app.module.ts`, add `import { ClientsModule } from './clients/clients.module';` and add `ClientsModule,` to the `imports` array (after `DepartmentsModule,`).

- [ ] **Step 8: Write the failing test**

`backend/src/clients/clients.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClientsService } from './clients.service';
import { Client } from './client.entity';

describe('ClientsService', () => {
  let service: ClientsService;
  let repo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 1, ...x })),
      findOne: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [ClientsService, { provide: getRepositoryToken(Client), useValue: repo }],
    }).compile();
    service = module.get(ClientsService);
  });

  it('creates a client scoped to the department in the DTO', async () => {
    const user = { sub: 12, role: 'HR', departmentId: 3 } as any;
    await service.create({ name: 'ABC Company', departmentId: 3 } as any, user);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ABC Company', department: { id: 3 }, createdBy: { id: 12 } }),
    );
  });

  it('blocks a MANAGER from creating a client outside their own department', async () => {
    const user = { sub: 12, role: 'MANAGER', departmentId: 3 } as any;
    await expect(
      service.create({ name: 'ABC Company', departmentId: 9 } as any, user),
    ).rejects.toThrow(ForbiddenException);
  });
});
```

- [ ] **Step 9: Run tests, implement/iterate until passing**

Run: `cd backend && npx jest clients.service.spec.ts`

- [ ] **Step 10: Commit**

```bash
git add src/database/migrations/1755000000004-CreateClientsTable.ts src/clients/ src/app.module.ts
git commit -m "feat(clients): add Client entity, CRUD API, and module"
```

---

## Task 5: Remove `Task.status`

**Files:**
- Create: `backend/src/database/migrations/1755000000005-RemoveStatusFromTasks.ts`
- Modify: `backend/src/tasks/task.entity.ts`
- Modify: `backend/src/tasks/dto/update-task.dto.ts`
- Test: `backend/src/tasks/tasks.service.spec.ts`

**Interfaces:**
- Produces: `Task` with no `status` field; `UpdateTaskDto` with no `status` field.

- [ ] **Step 1: Write the migration**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveStatusFromTasks1755000000005 implements MigrationInterface {
  name = 'RemoveStatusFromTasks1755000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "status"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" ADD COLUMN "status" varchar NOT NULL DEFAULT 'open'`);
  }
}
```

- [ ] **Step 2: Remove the column from the entity**

In `backend/src/tasks/task.entity.ts`, delete:

```ts
  @Column({ default: 'open' })
  status!: string; // open | in_progress | done | archived
```

- [ ] **Step 3: Remove `status` from `UpdateTaskDto`**

`backend/src/tasks/dto/update-task.dto.ts` becomes:

```ts
import { PartialType } from '@nestjs/swagger';
import { CreateTaskDto } from './create-task.dto';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
```

(`ApiPropertyOptional`/`IsIn`/`IsOptional` imports are no longer used in this file — remove them.)

- [ ] **Step 4: Write the failing test**

Create `backend/src/tasks/tasks.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { Task } from './task.entity';
import { TimeEntry } from '../time-entries/time-entry.entity';

describe('TasksService', () => {
  let service: TasksService;
  let tasksRepo: { create: jest.Mock; save: jest.Mock };
  let timeEntriesRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    tasksRepo = { create: jest.fn((x) => x), save: jest.fn((x) => Promise.resolve({ id: 1, ...x })) };
    timeEntriesRepo = {};
    const module = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task), useValue: tasksRepo },
        { provide: getRepositoryToken(TimeEntry), useValue: timeEntriesRepo },
      ],
    }).compile();
    service = module.get(TasksService);
  });

  it('creates a task without a status field', async () => {
    const user = { sub: 1, role: 'HR', departmentId: 1 } as any;
    const task = await service.create(
      { title: 'Build API', departmentId: 1, assignedToId: 2 } as any,
      user,
    );
    expect(task).not.toHaveProperty('status');
  });
});
```

- [ ] **Step 5: Run test, verify it passes once Steps 2-3 land**

Run: `cd backend && npx jest tasks.service.spec.ts`

- [ ] **Step 6: Commit**

```bash
git add src/database/migrations/1755000000005-RemoveStatusFromTasks.ts src/tasks/task.entity.ts src/tasks/dto/update-task.dto.ts src/tasks/tasks.service.spec.ts
git commit -m "feat(tasks): remove status column"
```

---

## Task 6: `Task.clientId` + assign-client endpoint

**Files:**
- Create: `backend/src/database/migrations/1755000000006-AddClientIdToTasks.ts`
- Create: `backend/src/tasks/dto/assign-client.dto.ts`
- Modify: `backend/src/tasks/task.entity.ts`
- Modify: `backend/src/tasks/dto/create-task.dto.ts`
- Modify: `backend/src/tasks/tasks.service.ts`
- Modify: `backend/src/tasks/tasks.controller.ts`
- Modify: `backend/src/tasks/tasks.module.ts`
- Test: `backend/src/tasks/tasks.service.spec.ts`

**Interfaces:**
- Consumes: `Client` (`backend/src/clients/client.entity.ts`, Task 4).
- Produces: `Task.client: Client | null`; `CreateTaskDto.clientId: number` (required); `TasksService.assignClient(id: number, dto: AssignClientDto, user: AuthenticatedUser): Promise<Task>`.

- [ ] **Step 1: Write the migration**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientIdToTasks1755000000006 implements MigrationInterface {
  name = 'AddClientIdToTasks1755000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" ADD COLUMN "clientId" integer`);
    await queryRunner.query(`
      ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_client"
      FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`CREATE INDEX "IDX_tasks_client" ON "tasks" ("clientId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_client"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_client"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "clientId"`);
  }
}
```

- [ ] **Step 2: Add the relation to the entity**

In `backend/src/tasks/task.entity.ts`, add `import { Client } from '../clients/client.entity';` and add:

```ts
  @ManyToOne(() => Client, (c) => c.tasks, { nullable: true })
  client!: Client | null;
```

- [ ] **Step 3: Add required `clientId` to `CreateTaskDto`**

In `backend/src/tasks/dto/create-task.dto.ts`, add after `assignedToId`:

```ts
  @ApiProperty()
  @IsInt()
  clientId: number;
```

- [ ] **Step 4: Create `AssignClientDto`**

`backend/src/tasks/dto/assign-client.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class AssignClientDto {
  @ApiProperty()
  @IsInt()
  clientId: number;
}
```

- [ ] **Step 5: Set client on create; add `assignClient`**

In `backend/src/tasks/tasks.service.ts`:
- Add `import { Client } from '../clients/client.entity';`
- Inject a `Client` repository in the constructor: add `@InjectRepository(Client) private clientsRepo: Repository<Client>,` as a new constructor parameter.
- In `create()`, add `client: { id: dto.clientId } as any,` to the object passed to `this.tasksRepo.create({...})`.
- Add a new method:

```ts
  public async assignClient(id: number, dto: AssignClientDto, user: AuthenticatedUser): Promise<Task> {
    const task = await this.findById(id);

    if (user.role === 'MANAGER' && task.department?.id !== user.departmentId) {
      throw new ForbiddenException('Managers may only reassign tasks within their own department');
    }

    const client = await this.clientsRepo.findOne({ where: { id: dto.clientId }, relations: { department: true } });
    if (!client) {
      throw new NotFoundException(`Client ${dto.clientId} not found`);
    }
    if (user.role === 'MANAGER' && client.department?.id !== user.departmentId) {
      throw new ForbiddenException('Managers may only assign clients within their own department');
    }

    task.client = client;
    return this.tasksRepo.save(task);
  }
```

Add `AssignClientDto` to the imports.

- [ ] **Step 6: Add the endpoint**

In `backend/src/tasks/tasks.controller.ts`, add `import { AssignClientDto } from './dto/assign-client.dto';` and:

```ts
  @Patch(':id/assign-client')
  @Roles('HR', 'MANAGER', 'ADMIN')
  assignClient(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignClientDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Task> {
    return this.tasksService.assignClient(id, dto, user);
  }
```

- [ ] **Step 7: Register `Client` in the module**

In `backend/src/tasks/tasks.module.ts`, add `import { Client } from '../clients/client.entity';` and change `TypeOrmModule.forFeature([Task, TimeEntry])` to `TypeOrmModule.forFeature([Task, TimeEntry, Client])`.

- [ ] **Step 8: Write the failing test**

Add to `backend/src/tasks/tasks.service.spec.ts` (extend the test module's providers with `{ provide: getRepositoryToken(Client), useValue: clientsRepo }` where `clientsRepo = { findOne: jest.fn() }`, and update the `TasksService` constructor call site implicitly via DI):

```ts
import { NotFoundException } from '@nestjs/common';
import { Client } from '../clients/client.entity';

// add clientsRepo to the outer describe scope and wire it into providers in beforeEach:
//   clientsRepo = { findOne: jest.fn() };
//   providers: [..., { provide: getRepositoryToken(Client), useValue: clientsRepo }]

  it('assigns a client to a task', async () => {
    tasksRepo.findOne = jest.fn().mockResolvedValue({ id: 1, department: { id: 1 } });
    clientsRepo.findOne.mockResolvedValue({ id: 7, department: { id: 1 } });
    const user = { sub: 1, role: 'HR', departmentId: 1 } as any;

    const task = await service.assignClient(1, { clientId: 7 } as any, user);
    expect(task.client).toEqual({ id: 7, department: { id: 1 } });
  });

  it('throws NotFoundException assigning a non-existent client', async () => {
    tasksRepo.findOne = jest.fn().mockResolvedValue({ id: 1, department: { id: 1 } });
    clientsRepo.findOne.mockResolvedValue(null);
    const user = { sub: 1, role: 'HR', departmentId: 1 } as any;

    await expect(service.assignClient(1, { clientId: 99 } as any, user)).rejects.toThrow(NotFoundException);
  });
```

`TasksService.findById` uses `tasksRepo.findOne` internally, so the mock above satisfies both the `findById` call inside `assignClient` and any direct call.

- [ ] **Step 9: Run tests, implement/iterate until passing**

Run: `cd backend && npx jest tasks.service.spec.ts`
Also run: `cd backend && npm run build` — confirms `Client.tasks` ↔ `Task.client` now resolves (Task 4's entity becomes fully valid here).

- [ ] **Step 10: Commit**

```bash
git add src/database/migrations/1755000000006-AddClientIdToTasks.ts src/tasks/ 
git commit -m "feat(tasks): add clientId relation and assign-client endpoint"
```

---

## Task 7: Task soft delete + delete-audit

**Files:**
- Create: `backend/src/database/migrations/1755000000007-AddSoftDeleteToTasks.ts`
- Modify: `backend/src/tasks/task.entity.ts`
- Modify: `backend/src/tasks/tasks.service.ts`
- Modify: `backend/src/tasks/tasks.controller.ts`
- Test: `backend/src/tasks/tasks.service.spec.ts`

**Interfaces:**
- Produces: `Task.deletedAt: Date | null`, `Task.deletedBy: Employee | null`; `TasksService.softDelete(id: number, actingUserId: number): Promise<void>`; `TasksService.restore(id: number): Promise<Task>`.

- [ ] **Step 1: Write the migration**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteToTasks1755000000007 implements MigrationInterface {
  name = 'AddSoftDeleteToTasks1755000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" ADD COLUMN "deletedAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD COLUMN "deletedById" integer`);
    await queryRunner.query(`
      ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_deletedBy"
      FOREIGN KEY ("deletedById") REFERENCES "employees"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`CREATE INDEX "IDX_tasks_deletedAt" ON "tasks" ("deletedAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_deletedAt"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_deletedBy"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "deletedById"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "deletedAt"`);
  }
}
```

- [ ] **Step 2: Add soft-delete fields to the entity**

In `backend/src/tasks/task.entity.ts`, add `DeleteDateColumn` to the `typeorm` import and add:

```ts
  @DeleteDateColumn()
  deletedAt!: Date | null;

  @ManyToOne(() => Employee, { nullable: true })
  deletedBy!: Employee | null;
```

- [ ] **Step 3: Add `softDelete`/`restore` to the service**

In `backend/src/tasks/tasks.service.ts`, add:

```ts
  public async softDelete(id: number, actingUserId: number): Promise<void> {
    await this.findById(id);
    await this.tasksRepo.update(id, { deletedAt: new Date(), deletedBy: { id: actingUserId } as any });
  }

  public async restore(id: number): Promise<Task> {
    const task = await this.tasksRepo.findOne({ where: { id }, withDeleted: true });
    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    await this.tasksRepo.update(id, { deletedAt: null, deletedBy: null });
    return this.findById(id);
  }
```

- [ ] **Step 4: Add delete/restore endpoints**

In `backend/src/tasks/tasks.controller.ts`, add `Delete` to the `@nestjs/common` import and add:

```ts
  @Delete(':id')
  @Roles('HR', 'ADMIN')
  public async softDelete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.tasksService.softDelete(id, user.sub);
    return { success: true };
  }

  @Patch(':id/restore')
  @Roles('HR', 'ADMIN')
  public restore(@Param('id', ParseIntPipe) id: number): Promise<Task> {
    return this.tasksService.restore(id);
  }
```

- [ ] **Step 5: Write the failing test**

Add to `backend/src/tasks/tasks.service.spec.ts`:

```ts
  it('sets deletedAt and deletedBy on softDelete', async () => {
    tasksRepo.findOne = jest.fn().mockResolvedValue({ id: 1 });
    tasksRepo.update = jest.fn();
    await service.softDelete(1, 9);
    expect(tasksRepo.update).toHaveBeenCalledWith(1, { deletedAt: expect.any(Date), deletedBy: { id: 9 } });
  });
```

- [ ] **Step 6: Run tests, implement/iterate until passing**

Run: `cd backend && npx jest tasks.service.spec.ts`

- [ ] **Step 7: Commit**

```bash
git add src/database/migrations/1755000000007-AddSoftDeleteToTasks.ts src/tasks/task.entity.ts src/tasks/tasks.service.ts src/tasks/tasks.controller.ts src/tasks/tasks.service.spec.ts
git commit -m "feat(tasks): soft delete with delete-audit trail"
```

---

## Task 8: Wire delete/restore cascades for Client and Department

**Files:**
- Modify: `backend/src/clients/clients.service.ts`
- Modify: `backend/src/clients/clients.controller.ts`
- Modify: `backend/src/clients/clients.module.ts`
- Modify: `backend/src/departments/departments.service.ts`
- Modify: `backend/src/departments/departments.controller.ts`
- Modify: `backend/src/departments/departments.module.ts`
- Test: `backend/src/clients/clients.service.spec.ts`
- Test: `backend/src/departments/departments.service.spec.ts`

**Interfaces:**
- Consumes: `Task` (Task 7, now has `client`/`deletedAt`/`deletedBy`); `Client` (Task 4/7's sibling state, now has `deletedAt`/`deletedBy`).
- Produces: `ClientsService.softDelete(id: number, actingUserId: number, force: boolean): Promise<void>`, `ClientsService.restore(id: number): Promise<Client>`; `DepartmentsService.softDelete(id: number, actingUserId: number, force: boolean): Promise<void>` (signature change from Task 3 — adds `force`).

- [ ] **Step 1: Add Task repo to ClientsModule**

In `backend/src/clients/clients.module.ts`, add `import { Task } from '../tasks/task.entity';` and change `TypeOrmModule.forFeature([Client])` to `TypeOrmModule.forFeature([Client, Task])`.

- [ ] **Step 2: Add `softDelete`/`restore` to `ClientsService`**

In `backend/src/clients/clients.service.ts`, add `ConflictException` to the `@nestjs/common` import, add `import { Task } from '../tasks/task.entity';`, inject a `Task` repository (`@InjectRepository(Task) private tasksRepo: Repository<Task>,`), and add:

```ts
  public async softDelete(id: number, actingUserId: number, force: boolean): Promise<void> {
    await this.findById(id);

    const activeTaskCount = await this.tasksRepo.count({ where: { client: { id } } });
    if (activeTaskCount > 0 && !force) {
      throw new ConflictException(
        `Client ${id} has ${activeTaskCount} active task(s). Pass force=true to also archive them.`,
      );
    }
    if (activeTaskCount > 0 && force) {
      await this.tasksRepo.update({ client: { id } } as any, {
        deletedAt: new Date(),
        deletedBy: { id: actingUserId } as any,
      });
    }

    await this.clientsRepo.update(id, { deletedAt: new Date(), deletedBy: { id: actingUserId } as any });
  }

  public async restore(id: number): Promise<Client> {
    const client = await this.clientsRepo.findOne({ where: { id }, withDeleted: true });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }
    await this.clientsRepo.update(id, { deletedAt: null, deletedBy: null });
    return this.findById(id);
  }
```

- [ ] **Step 3: Add delete/restore endpoints to `ClientsController`**

In `backend/src/clients/clients.controller.ts`, add `Delete` to the `@nestjs/common` import and add:

```ts
  @Delete(':id')
  @Roles('HR', 'ADMIN')
  public async softDelete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Query('force') force?: string,
  ): Promise<{ success: true }> {
    await this.clientsService.softDelete(id, user.sub, force === 'true');
    return { success: true };
  }

  @Patch(':id/restore')
  @Roles('HR', 'ADMIN')
  public restore(@Param('id', ParseIntPipe) id: number): Promise<Client> {
    return this.clientsService.restore(id);
  }
```

- [ ] **Step 4: Add Client repo to DepartmentsModule**

In `backend/src/departments/departments.module.ts`, add `import { Client } from '../clients/client.entity';` and change `TypeOrmModule.forFeature([Department])` to `TypeOrmModule.forFeature([Department, Client])`.

- [ ] **Step 5: Upgrade `DepartmentsService.softDelete` to add the cascade check**

In `backend/src/departments/departments.service.ts`, add `ConflictException` to the import, add `import { Client } from '../clients/client.entity';`, inject a `Client` repository, and replace the `softDelete` method from Task 3 with:

```ts
  public async softDelete(id: number, actingUserId: number, force: boolean): Promise<void> {
    await this.findById(id);

    const activeClientCount = await this.clientsRepo.count({ where: { department: { id } } });
    if (activeClientCount > 0 && !force) {
      throw new ConflictException(
        `Department ${id} has ${activeClientCount} active client(s). Pass force=true to also archive them.`,
      );
    }
    if (activeClientCount > 0 && force) {
      await this.clientsRepo.update({ department: { id } } as any, {
        deletedAt: new Date(),
        deletedBy: { id: actingUserId } as any,
      });
    }

    await this.departmentsRepo.update(id, { deletedAt: new Date(), deletedBy: { id: actingUserId } as any });
  }
```

- [ ] **Step 6: Update `DepartmentsController.softDelete` to accept `force`**

In `backend/src/departments/departments.controller.ts`, add `Query` to the `@nestjs/common` import and change the handler from Task 3 to:

```ts
  @Delete(':id')
  @Roles('HR', 'ADMIN')
  public async softDelete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Query('force') force?: string,
  ): Promise<{ success: true }> {
    await this.departmentsService.softDelete(id, user.sub, force === 'true');
    return { success: true };
  }
```

- [ ] **Step 7: Write the failing tests**

Add to `backend/src/clients/clients.service.spec.ts` (extend `repo` mock with `update`, add a `tasksRepo = { count: jest.fn(), update: jest.fn() }` and wire it into the test module's providers via `{ provide: getRepositoryToken(Task), useValue: tasksRepo }`, importing `Task` and `ConflictException`):

```ts
import { ConflictException } from '@nestjs/common';
import { Task } from '../tasks/task.entity';

  it('blocks softDelete when the client has active tasks and force is not set', async () => {
    repo.findOne.mockResolvedValue({ id: 7 });
    tasksRepo.count.mockResolvedValue(2);
    await expect(service.softDelete(7, 9, false)).rejects.toThrow(ConflictException);
  });

  it('cascades softDelete to active tasks when force is true', async () => {
    repo.findOne.mockResolvedValue({ id: 7 });
    tasksRepo.count.mockResolvedValue(2);
    await service.softDelete(7, 9, true);
    expect(tasksRepo.update).toHaveBeenCalledWith(
      { client: { id: 7 } },
      { deletedAt: expect.any(Date), deletedBy: { id: 9 } },
    );
    expect(repo.update).toHaveBeenCalledWith(7, { deletedAt: expect.any(Date), deletedBy: { id: 9 } });
  });
```

Add analogous tests to `backend/src/departments/departments.service.spec.ts` (mock a `clientsRepo = { count: jest.fn(), update: jest.fn() }`, wire via `getRepositoryToken(Client)`) mirroring the two cases above for `DepartmentsService.softDelete`.

- [ ] **Step 8: Run tests, implement/iterate until passing**

Run: `cd backend && npx jest clients.service.spec.ts departments.service.spec.ts`

- [ ] **Step 9: Commit**

```bash
git add src/clients/ src/departments/
git commit -m "feat(clients,departments): cascade-aware soft delete with force flag"
```

---

## Task 9: Remove pre-existing `CASCADE` foreign keys

**Files:**
- Create: `backend/src/database/migrations/1755000000008-RemoveCascadeFromLegacyForeignKeys.ts`

**Interfaces:**
- None (schema-only change; no entity/service/controller code references `ON DELETE` behavior directly).

- [ ] **Step 1: Write the migration**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveCascadeFromLegacyForeignKeys1755000000008 implements MigrationInterface {
  name = 'RemoveCascadeFromLegacyForeignKeys1755000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_department"`);
    await queryRunner.query(`
      ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_department"
      FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`ALTER TABLE "time_entries" DROP CONSTRAINT "FK_time_entries_employee"`);
    await queryRunner.query(`
      ALTER TABLE "time_entries" ADD CONSTRAINT "FK_time_entries_employee"
      FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`ALTER TABLE "time_entries" DROP CONSTRAINT "FK_time_entries_task"`);
    await queryRunner.query(`
      ALTER TABLE "time_entries" ADD CONSTRAINT "FK_time_entries_task"
      FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`ALTER TABLE "device_sessions" DROP CONSTRAINT "FK_device_sessions_employee"`);
    await queryRunner.query(`
      ALTER TABLE "device_sessions" ADD CONSTRAINT "FK_device_sessions_employee"
      FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "device_sessions" DROP CONSTRAINT "FK_device_sessions_employee"`);
    await queryRunner.query(`
      ALTER TABLE "device_sessions" ADD CONSTRAINT "FK_device_sessions_employee"
      FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`ALTER TABLE "time_entries" DROP CONSTRAINT "FK_time_entries_task"`);
    await queryRunner.query(`
      ALTER TABLE "time_entries" ADD CONSTRAINT "FK_time_entries_task"
      FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`ALTER TABLE "time_entries" DROP CONSTRAINT "FK_time_entries_employee"`);
    await queryRunner.query(`
      ALTER TABLE "time_entries" ADD CONSTRAINT "FK_time_entries_employee"
      FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_department"`);
    await queryRunner.query(`
      ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_department"
      FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE
    `);
  }
}
```

- [ ] **Step 2: Run the full migration chain against a real (dev) database**

Run: `cd backend && npm run migration:run`
Expected: all 8 new migrations (Tasks 1-9, this one included) apply cleanly in order against `.env.development`'s `DATABASE_URL`.

- [ ] **Step 3: Spot-check the constraint change**

Run (via `psql` or the Neon SQL console): `SELECT conname, confdeltype FROM pg_constraint WHERE conname = 'FK_tasks_department';`
Expected: `confdeltype` is `r` (RESTRICT), not `c` (CASCADE).

- [ ] **Step 4: Commit**

```bash
git add src/database/migrations/1755000000008-RemoveCascadeFromLegacyForeignKeys.ts
git commit -m "fix(schema): remove all ON DELETE CASCADE, use RESTRICT"
```

---

## Task 10: Audit API

**Files:**
- Create: `backend/src/audit/interfaces/audit-entry.interface.ts`
- Create: `backend/src/audit/dto/query-audit.dto.ts`
- Create: `backend/src/audit/audit.service.ts`
- Create: `backend/src/audit/audit.controller.ts`
- Create: `backend/src/audit/audit.module.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/src/audit/audit.service.spec.ts`

**Interfaces:**
- Consumes: `Employee`, `Department`, `Client`, `Task` (all now carry `deletedAt`/`deletedBy`, and `Client`/`Task` carry `createdBy`/`createdAt` where applicable).
- Produces: `AuditService.findDeletions(query: QueryAuditDto): Promise<AuditEntry[]>`; `AuditService.findOne(entityType: AuditEntityType, id: number): Promise<AuditEntry>`.

- [ ] **Step 1: Create the shared types**

`backend/src/audit/interfaces/audit-entry.interface.ts`:

```ts
export type AuditEntityType = 'employee' | 'department' | 'client' | 'task';

export interface AuditActor {
  id: number;
  fullName: string;
  username: string;
}

export interface AuditEntry {
  entityType: AuditEntityType;
  id: number;
  label: string;
  createdAt: Date | null;
  createdBy: AuditActor | null;
  deletedAt: Date;
  deletedBy: AuditActor | null;
}
```

- [ ] **Step 2: Create the query DTO**

`backend/src/audit/dto/query-audit.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional } from 'class-validator';

export class QueryAuditDto {
  @ApiPropertyOptional({ enum: ['employee', 'department', 'client', 'task'] })
  @IsOptional()
  @IsIn(['employee', 'department', 'client', 'task'])
  entityType?: 'employee' | 'department' | 'client' | 'task';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deletedById?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}
```

- [ ] **Step 3: Create the service**

`backend/src/audit/audit.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { Department } from '../departments/department.entity';
import { Client } from '../clients/client.entity';
import { Task } from '../tasks/task.entity';
import { QueryAuditDto } from './dto/query-audit.dto';
import { AuditActor, AuditEntityType, AuditEntry } from './interfaces/audit-entry.interface';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(Employee) private employeesRepo: Repository<Employee>,
    @InjectRepository(Department) private departmentsRepo: Repository<Department>,
    @InjectRepository(Client) private clientsRepo: Repository<Client>,
    @InjectRepository(Task) private tasksRepo: Repository<Task>,
  ) {}

  private toActor(employee: Employee | null | undefined): AuditActor | null {
    if (!employee) return null;
    return { id: employee.id, fullName: employee.fullName, username: employee.username };
  }

  private applyCommonFilters(rows: AuditEntry[], query: QueryAuditDto): AuditEntry[] {
    return rows.filter((row) => {
      if (query.deletedById !== undefined && row.deletedBy?.id !== query.deletedById) return false;
      if (query.from && row.deletedAt < new Date(query.from)) return false;
      if (query.to && row.deletedAt > new Date(query.to)) return false;
      return true;
    });
  }

  private async loadEmployeeDeletions(query: QueryAuditDto): Promise<AuditEntry[]> {
    const rows = await this.employeesRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.deletedBy', 'deletedBy')
      .withDeleted()
      .andWhere('employee.deletedAt IS NOT NULL')
      .getMany();

    return this.applyCommonFilters(
      rows.map((employee) => ({
        entityType: 'employee' as const,
        id: employee.id,
        label: employee.fullName,
        createdAt: employee.createdAt,
        createdBy: null,
        deletedAt: employee.deletedAt as Date,
        deletedBy: this.toActor(employee.deletedBy),
      })),
      query,
    );
  }

  private async loadDepartmentDeletions(query: QueryAuditDto): Promise<AuditEntry[]> {
    const rows = await this.departmentsRepo
      .createQueryBuilder('department')
      .leftJoinAndSelect('department.deletedBy', 'deletedBy')
      .withDeleted()
      .andWhere('department.deletedAt IS NOT NULL')
      .getMany();

    return this.applyCommonFilters(
      rows.map((department) => ({
        entityType: 'department' as const,
        id: department.id,
        label: department.name,
        createdAt: null,
        createdBy: null,
        deletedAt: department.deletedAt as Date,
        deletedBy: this.toActor(department.deletedBy),
      })),
      query,
    );
  }

  private async loadClientDeletions(query: QueryAuditDto): Promise<AuditEntry[]> {
    const rows = await this.clientsRepo
      .createQueryBuilder('client')
      .leftJoinAndSelect('client.deletedBy', 'deletedBy')
      .leftJoinAndSelect('client.createdBy', 'createdBy')
      .withDeleted()
      .andWhere('client.deletedAt IS NOT NULL')
      .getMany();

    return this.applyCommonFilters(
      rows.map((client) => ({
        entityType: 'client' as const,
        id: client.id,
        label: client.name,
        createdAt: client.createdAt,
        createdBy: this.toActor(client.createdBy),
        deletedAt: client.deletedAt as Date,
        deletedBy: this.toActor(client.deletedBy),
      })),
      query,
    );
  }

  private async loadTaskDeletions(query: QueryAuditDto): Promise<AuditEntry[]> {
    const rows = await this.tasksRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.deletedBy', 'deletedBy')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .withDeleted()
      .andWhere('task.deletedAt IS NOT NULL')
      .getMany();

    return this.applyCommonFilters(
      rows.map((task) => ({
        entityType: 'task' as const,
        id: task.id,
        label: task.title,
        createdAt: null,
        createdBy: this.toActor(task.createdBy),
        deletedAt: task.deletedAt as Date,
        deletedBy: this.toActor(task.deletedBy),
      })),
      query,
    );
  }

  public async findDeletions(query: QueryAuditDto): Promise<AuditEntry[]> {
    const loaders: Array<{ type: AuditEntityType; load: () => Promise<AuditEntry[]> }> = [
      { type: 'employee', load: () => this.loadEmployeeDeletions(query) },
      { type: 'department', load: () => this.loadDepartmentDeletions(query) },
      { type: 'client', load: () => this.loadClientDeletions(query) },
      { type: 'task', load: () => this.loadTaskDeletions(query) },
    ];

    const selected = query.entityType ? loaders.filter((l) => l.type === query.entityType) : loaders;
    const results = await Promise.all(selected.map((l) => l.load()));

    return results.flat().sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
  }

  public async findOne(entityType: AuditEntityType, id: number): Promise<AuditEntry> {
    const all = await this.findDeletions({ entityType } as QueryAuditDto);
    const entry = all.find((e) => e.id === id);
    if (!entry) {
      throw new NotFoundException(`No deleted ${entityType} found with id ${id}`);
    }
    return entry;
  }
}
```

- [ ] **Step 4: Create the controller**

`backend/src/audit/audit.controller.ts`:

```ts
import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import { AuditEntityType, AuditEntry } from './interfaces/audit-entry.interface';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('HR', 'ADMIN')
@Controller('audit')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('deletions')
  public findDeletions(@Query() query: QueryAuditDto): Promise<AuditEntry[]> {
    return this.auditService.findDeletions(query);
  }

  @Get('deletions/:entityType/:id')
  public findOne(
    @Param('entityType') entityType: AuditEntityType,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AuditEntry> {
    return this.auditService.findOne(entityType, id);
  }
}
```

- [ ] **Step 5: Create the module**

`backend/src/audit/audit.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../employees/employee.entity';
import { Department } from '../departments/department.entity';
import { Client } from '../clients/client.entity';
import { Task } from '../tasks/task.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, Department, Client, Task])],
  providers: [AuditService],
  controllers: [AuditController],
})
export class AuditModule {}
```

- [ ] **Step 6: Register the module**

In `backend/src/app.module.ts`, add `import { AuditModule } from './audit/audit.module';` and add `AuditModule,` to the `imports` array (after `ClientsModule,`).

- [ ] **Step 7: Write the failing test**

`backend/src/audit/audit.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { Employee } from '../employees/employee.entity';
import { Department } from '../departments/department.entity';
import { Client } from '../clients/client.entity';
import { Task } from '../tasks/task.entity';

function makeQb(rows: any[]) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    withDeleted: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
  };
}

describe('AuditService', () => {
  let service: AuditService;
  let employeesRepo: { createQueryBuilder: jest.Mock };
  let departmentsRepo: { createQueryBuilder: jest.Mock };
  let clientsRepo: { createQueryBuilder: jest.Mock };
  let tasksRepo: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    employeesRepo = { createQueryBuilder: jest.fn().mockReturnValue(makeQb([])) };
    departmentsRepo = { createQueryBuilder: jest.fn().mockReturnValue(makeQb([])) };
    clientsRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(
        makeQb([
          {
            id: 7,
            name: 'ABC Company',
            createdAt: new Date('2026-01-10'),
            createdBy: { id: 12, fullName: 'Muhammad Bilal', username: 'bilal.m' },
            deletedAt: new Date('2026-08-12'),
            deletedBy: { id: 4, fullName: 'Sara HR', username: 'sara.hr' },
          },
        ]),
      ),
    };
    tasksRepo = { createQueryBuilder: jest.fn().mockReturnValue(makeQb([])) };

    const module = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(Employee), useValue: employeesRepo },
        { provide: getRepositoryToken(Department), useValue: departmentsRepo },
        { provide: getRepositoryToken(Client), useValue: clientsRepo },
        { provide: getRepositoryToken(Task), useValue: tasksRepo },
      ],
    }).compile();
    service = module.get(AuditService);
  });

  it('returns only the requested entityType', async () => {
    const results = await service.findDeletions({ entityType: 'client' } as any);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ entityType: 'client', id: 7, label: 'ABC Company' });
    expect(employeesRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('findOne throws NotFoundException when nothing matches', async () => {
    await expect(service.findOne('task', 999)).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 8: Run tests, implement/iterate until passing**

Run: `cd backend && npx jest audit.service.spec.ts`

- [ ] **Step 9: Full-suite + build check**

Run: `cd backend && npm run build && npx jest`
Expected: build succeeds, all specs across every task in this plan pass.

- [ ] **Step 10: Commit**

```bash
git add src/audit/ src/app.module.ts
git commit -m "feat(audit): cross-entity deletion audit API"
```

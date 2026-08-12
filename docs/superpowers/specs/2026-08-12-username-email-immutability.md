# How `username`/`email` Immutability Is (and Isn't) Enforced

## Current state — read this first

**Only `username` is protected today, and only at the application layer.
`email` is fully mutable right now.** This doc was requested assuming both
were locked down at the database level; neither is true yet. The rest of
this file explains exactly what exists, why it's not the same as DB-level
immutability, and what real DB-level enforcement would look like if you
want it added.

| Field | Protected from change? | Where | How |
|---|---|---|---|
| `username` | Yes | Application layer only | `UpdateEmployeeDto` omits `username` |
| `email` | **No** | — | Fully editable via `PATCH /employees/:id` |

## How `username` immutability actually works today

There is no database constraint, trigger, or rule involved. It's enforced
entirely by **what the update DTO is allowed to contain**, combined with a
global pipe setting that already existed in this codebase before this
feature:

**1. `UpdateEmployeeDto` never declares a `username` field**
(`backend/src/employees/dto/update-employee.dto.ts`):

```ts
export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['password', 'username'] as const),
) {}
```

**2. The global `ValidationPipe` rejects unknown properties**
(`backend/src/main.ts:42-48`, already in place, not added for this feature):

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,            // strips any property not in the DTO
    forbidNonWhitelisted: true, // throws 400 if an unknown property is sent
    transform: true,
  }),
);
```

Because `forbidNonWhitelisted: true` is set, a `PATCH /employees/:id` body
containing `"username": "..."` doesn't get silently dropped — it fails the
whole request with a `400 Bad Request` before the controller or service ever
runs.

**3. `EmployeesService.update()` never reads `dto.username`** — even if
something upstream of the DTO managed to smuggle a value through, the
service's field-by-field assignment (`if (dto.fullName !== undefined) ...`)
has no line for `username`, so there's nothing for it to write.

### Why this is not database-level enforcement

All three of the above are **HTTP-request-time** checks. None of them
apply to:

- A raw `UPDATE employees SET username = ... WHERE id = ...` run directly
  against Postgres (psql, a DB admin tool, a future one-off script).
- A different application, service, or internal tool that talks to the same
  database without going through this NestJS API.
- A bug or a future code change in `EmployeesService` that starts assigning
  `username` from somewhere else.
- TypeORM's `repository.save()`/`update()` called from anywhere else in this
  codebase with `{ username: ... }` in the payload.

The database itself currently has **no opinion** about whether `username`
can change — it only enforces that the value is unique-while-active
(`UQ_employees_username_active`, from migration `1755000000002`). Uniqueness
and immutability are two different guarantees; only the first one is
DB-enforced right now.

## What real database-level immutability requires

Postgres has no built-in "immutable column" feature. `CHECK` constraints
can't reference the row's *previous* value — only a **trigger** can compare
`OLD` vs `NEW` and reject the `UPDATE` outright. This is the only mechanism
that closes every gap listed above, because it runs inside Postgres itself
regardless of what issued the `UPDATE`.

Example for `username` (this is **not yet implemented** — shown so you can
decide whether to add it):

```sql
CREATE OR REPLACE FUNCTION prevent_employee_username_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    RAISE EXCEPTION 'username is immutable and cannot be changed (employee id %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_employees_username_immutable
BEFORE UPDATE ON "employees"
FOR EACH ROW
EXECUTE FUNCTION prevent_employee_username_change();
```

With this in place, **any** `UPDATE` that changes `username` — from the API,
from psql, from a script — fails at the database with a Postgres error
(`P0001`), not just a `400` from this one API.

The identical pattern would apply to `email` if you decide it should also
become immutable — same trigger function shape, just checking
`NEW.email IS DISTINCT FROM OLD.email`.

### Trade-off: this also blocks legitimate fixes

A hard trigger like the one above blocks *every* update, including a
deliberate data-correction script run by an admin (e.g. "this employee's
username was seeded wrong, fix it once"). The two ways to handle that:

- **Accept the friction**: fixing a mistake requires
  `ALTER TABLE "employees" DISABLE TRIGGER trg_employees_username_immutable;`,
  running the fix, then re-enabling it. Explicit and auditable, but manual.
- **Add an escape hatch**: gate the trigger on a session flag
  (e.g. `current_setting('app.allow_immutable_override', true)`), only ever
  set by a trusted maintenance script, never by the application. More
  flexible, more surface area to get wrong.

Neither is implemented — this is a decision, not a default.

## Open question: should `email` be immutable too?

Nothing in the original request asked for `email` to be immutable — only
`username` (`Update_MIGRATION.md` and your explicit instruction were both
username-specific). Employees legitimately change email addresses (name
changes, domain migrations, typos at hire time), so making `email` immutable
would be an unusual constraint for an HR system unless there's a specific
reason (e.g. email is used as an external identity-linking key somewhere).
Flagging this rather than assuming — say the word and I'll add the DB
trigger for `username` (and `email`, if you want it) as a new migration.

# Backend CI Workflow — Design

## Goal

Add a lightweight CI check that runs on pull requests and non-`main` branch
pushes, catching lint/build breakage before merge. This is separate from
the existing `backend/.github/workflows/deploy.yml` (which builds/pushes a
Docker image and deploys to the VPS on push to `main`) — that file is
intentionally left untouched by this work.

## File

`backend/.github/workflows/ci.yml`

## Trigger

- `pull_request` targeting `main`
- `push` on any branch except `main` (main's push is already covered by
  the existing deploy workflow, so this avoids a duplicate run)

## Job: `lint-and-build`

Runs on `ubuntu-latest`:

1. `actions/checkout@v4`
2. `actions/setup-node@v4` — Node 20, `cache: npm` keyed off
   `backend/package-lock.json`
3. `npm ci`
4. `npm run lint`
5. `npm run build`

## Explicitly out of scope

- **No test step.** `backend/src` and `backend/test` currently contain zero
  `*.spec.ts` files, so `npm run test` would fail immediately with jest's
  "no tests found" error on every run. Add a test step once real specs
  exist.
- **No secrets, no Docker, no SSH.** This workflow never touches
  prod/staging — it only runs lint and build on GitHub's runner.
- **No changes to `deploy.yml`.** Its known issues (wrong `ssh-action`
  inputs, bypassing `docker-compose.prod.yml`, undefined `IMAGE_NAME`) are
  out of scope for this task per explicit instruction.

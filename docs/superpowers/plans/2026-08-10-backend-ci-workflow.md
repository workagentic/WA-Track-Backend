# Backend CI Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `backend/.github/workflows/ci.yml`, a GitHub Actions workflow that lints and builds the NestJS backend on every pull request into `main` and on pushes to any non-`main` branch.

**Architecture:** A single-job workflow (`lint-and-build`) running on `ubuntu-latest`: checkout → Node 20 setup with npm cache → `npm ci` → `npm run lint` → `npm run build`. No secrets, no Docker, no deploy steps — this workflow never touches `backend/.github/workflows/deploy.yml` or anything it does.

**Tech Stack:** GitHub Actions (`actions/checkout@v4`, `actions/setup-node@v4`), npm, ESLint, NestJS CLI (`nest build`).

## Global Constraints

- Node version: 20 (matches the existing `deploy.yml`'s `setup-node` version, so lint/build run against the same runtime as production).
- Do not modify, touch, or reference `backend/.github/workflows/deploy.yml` in any way.
- No test step — `backend/src` and `backend/test` contain zero `*.spec.ts` files today, so `npm run test` would fail immediately with jest's "no tests found" error. (Per spec: `docs/superpowers/specs/2026-08-10-backend-ci-workflow-design.md`.)
- Trigger must not double-run on `main` pushes (that's already covered by `deploy.yml`), so `push` is scoped to `branches-ignore: [main]`.

---

### Task 1: Create the CI workflow file

**Files:**
- Create: `backend/.github/workflows/ci.yml`

**Interfaces:**
- N/A — this is a standalone GitHub Actions workflow file, not consumed by any other code in this repo.

- [ ] **Step 1: Write the workflow file**

Create `backend/.github/workflows/ci.yml` with this exact content:

```yaml
name: Backend CI

on:
  pull_request:
    branches:
      - main
  push:
    branches-ignore:
      - main

jobs:
  lint-and-build:
    name: Lint and build
    runs-on: ubuntu-latest

    steps:
      - name: Checkout source
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build
```

- [ ] **Step 2: Validate the YAML is well-formed**

Run from `backend/`:

```bash
node -e "const y=require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci.yml','utf8')); console.log(JSON.stringify(y, null, 2))"
```

Expected: prints the parsed structure with no thrown error, and the printed object has top-level keys `name`, `on`, `jobs`, with `jobs.lint-and-build.steps` containing 4 entries.

- [ ] **Step 3: Confirm the lint and build scripts referenced actually exist and pass locally**

Run from `backend/`:

```bash
npm run lint
npm run build
```

Expected: both exit 0. (This is the same command the workflow will run — confirming it passes locally now means the first real CI run won't fail on pre-existing lint/build issues unrelated to this change.)

- [ ] **Step 4: Confirm `deploy.yml` is untouched**

Run from `backend/`:

```bash
git status --short .github/workflows/deploy.yml
```

Expected: no output (or, if `deploy.yml` was already untracked/modified before this task, output identical to what it was before Step 1 — this task must not add any diff to that file).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add lint/build workflow for PRs and non-main pushes"
```

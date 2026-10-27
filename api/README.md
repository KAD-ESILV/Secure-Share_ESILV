# DevOps Lab – Student Project (Node.js + Jira/GitHub + CI/CD)

This repository is a **teaching template** for a 4-student DevOps mini-project.
It demonstrates a realistic workflow: **PLAN (Jira) → CODE (Git/VS Code) → BUILD/TEST (GitHub Actions) → REVIEW (PRs) → DEPLOY (optional)**.

> **What you get here**
> - Minimal **Express** API with auto-mounted routes
> - **Vitest + Supertest** for integration & unit tests
> - Coverage thresholds enforced in CI
> - **GitHub Actions** workflow for lint + tests + coverage artifact
> - Clear file layout for a team of 4

---

## Quickstart

```bash
npm ci
npm run dev          # http://localhost:3000
npm test -- --coverage
```

Open `coverage/index.html` for a visual coverage report (locally).

---

## Routes

- `GET /` – basic JSON greeting
- `GET /health` – health check (200 OK)
- `GET /version` – returns `{ version }` from `package.json`
- `GET /info` – returns `{ name, version, node, uptime }`
- `GET /boom` – triggers an error to test the global error handler

Routes are **auto-mounted** from `src/routes/auto/*.route.js` so each student can add a file without touching `src/app.js` (fewer merge conflicts).

---

## Tests

- **Integration tests** (Supertest) target HTTP endpoints in `test/*.test.js`.
- **Unit tests** target internal logic in `test/unit/*.test.js`.

Coverage thresholds (Lines/Functions/Statements ≥ 80%, Branches ≥ 70%) are set in `package.json`.  
If coverage drops below thresholds, CI fails and blocks the merge (quality gate).

---

## Branch & Commit Convention (Jira-friendly)

- Branch: `feature/<ISSUE-KEY>-<short-desc>` → e.g., `feature/SHMS-12-info-endpoint`
- Commit: `feat(<ISSUE-KEY>): <what>` → e.g., `feat(SHMS-12): implement /info endpoint`
- PR title: `<ISSUE-KEY> | <title>` → e.g., `SHMS-12 | Add /info endpoint`

If you install **GitHub for Jira**, issues will link automatically when the key appears in branch/commit/PR.

---

## CI (GitHub Actions)

A workflow is included at `.github/workflows/ci.yml` that runs on pushes and PRs to `main`:

- Install Node and deps
- `npm run lint`
- `npm test -- --coverage`
- Upload `coverage/` as an artifact

> Badge (enable after first run):
>
> ```md
> ![CI](https://github.com/<org>/<repo>/actions/workflows/ci.yml/badge.svg)
> ```

---

## Project layout

```
src/
  app.js          # Express app (auto-mount + global error handler)
  index.js        # server entry (not used by tests)
  routes/auto/    # students add *.route.js files here
  utils/          # small testable helpers
test/
  *.test.js       # integration (HTTP) tests
  unit/*.test.js  # pure unit tests
```

---

## Useful scripts

- `npm run dev` – start dev server with nodemon
- `npm test` – run all tests (Vitest)
- `npm test -- --coverage` – with coverage
- `npm run lint` – ESLint check

Enjoy the lab!

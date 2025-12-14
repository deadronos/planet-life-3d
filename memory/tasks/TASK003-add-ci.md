# [TASK003] - Add CI: Build + Tests

**Status:** Pending
**Added:** 2025-12-13
**Updated:** 2025-12-14

## Original Request

Add a GitHub Actions workflow to run `npm ci`, `npm run build` and run unit tests.

## Implementation Plan

- Create a minimal `.github/workflows/ci.yml` that runs `npm ci` and `npm run build` on push/PR.
- Expand to run `npm test` when test harness is available.
- Add caching for `node_modules` to accelerate CI.

## Notes

- Keep the workflow minimal to start; avoid running unnecessary steps.
- Note: Vitest is present and current tests are runnable locally using `npm run test`; include `npm run test` as a job step.

## Progress

- A Pages deployment workflow was added (`.github/workflows/deploy-pages.yml`) to deploy tagged builds to GitHub Pages (See TASK012). However, a CI workflow that runs `npm ci` + `npm run build` + `npm run test` on PRs is not present yet and remains the core TODO for this task.

## Recommended next steps

- Add `.github/workflows/ci.yml` that:
  - Runs on `push` and `pull_request` (branches: main, dev)
  - Installs dependencies (`npm ci`) and runs `npm run build` (which includes `tsc -b` for type checks)
  - Runs `npm run test` (Vitest) and optionally `npm run lint`
  - Adds caching for the package-manager artifacts to speed CI
  - Optionally add a `coverage` job or code-quality gate in future PRs

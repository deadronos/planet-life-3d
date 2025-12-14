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

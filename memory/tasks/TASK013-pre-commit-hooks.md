# [TASK013] - Document Pre-commit Hooks & lint-staged

**Status:** Completed  
**Added:** 2025-12-13  
**Updated:** 2025-12-13

## Original Request

Add pre-commit hooks to run format/lint checks locally via `lint-staged` and ensure consistency across commits.

## Implementation Summary

- Added `lint-staged` + pre-commit hook configuration (commit: `9cf2d30`), and verified by adding a test commit that triggers `lint-staged` pre-commit.

## Files changed

- `package.json` (scripts & lint-staged config)
- `.husky` / pre-commit setup (if present)

## Validation

- Confirmed pre-commit hook runs on local commits in development environment (see commit `7e737fd`).

## Notes

- Add a short developer note to `CONTRIBUTING.md` if the team wants to standardize pre-commit runner expectations across environments.

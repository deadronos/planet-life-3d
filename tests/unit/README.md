# Unit tests (tests/unit)

Purpose:

- Put fast, deterministic unit tests here for pure logic and utility functions.
- Tests should not depend on a DOM or slow I/O.

Guidelines:

- Use Vitest (`vitest`) for unit tests. Files should be named `*.spec.ts` or `*.test.ts`.
- Put tests that exercise `src/sim/*` logic (e.g., `LifeSphereSim`, `patterns.ts`) here.
- Keep tests small and focused; use dependency injection/specific RNG seeds to ensure determinism.

Example:

```ts
import { describe, it, expect } from 'vitest';
import { parseAsciiPattern } from '../../src/sim/patterns';

describe('parseAsciiPattern', () => {
  it('parses a simple glider', () => {
    const ascii = `.O.\n..O\nOOO`;
    const offsets = parseAsciiPattern(ascii);
    expect(offsets.length).toBe(5);
  });
});
```

Commands:

- Run all tests: `npm run test`
- Run watch mode: `npm run test:watch`
- Coverage: `npm run test:coverage`

Notes:

- Tests run under Vitest benefit from types available via `vitest/globals` (tsconfig is set to include `tests`).
- Pure logic code is the best candidate for these unit tests; UI-heavy code belongs in component tests or integration tests.

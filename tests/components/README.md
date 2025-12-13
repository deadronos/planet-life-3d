# Component tests (tests/components)

Purpose:

- Place component-focused tests here, especially those that assert UI rendering, behaviour, and interactions for React components.
- Use `*.spec.tsx` or `*.test.tsx` naming and run with Vitest.

Guidelines:

- Prefer `@testing-library/react` for testing React components and user interactions. Use `jsdom` environment (configured in `vitest.config.ts`).
- For `react-three-fiber` components (3D Canvas), prefer to test small logic and event handling; full three.js rendering may be flaky under `jsdom`.
- For canvas and WebGL-specific behaviour, consider integration tests or Playwright-based e2e tests.

Example (basic render):

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlanetLife from '../../src/components/PlanetLife';

describe('PlanetLife component', () => {
  it('renders without crashing', () => {
    render(<PlanetLife />);
    // Verify a label or element provided by the UI exists
    // e.g., expect(screen.getByText(/Simulation/i)).toBeInTheDocument();
  });
});
```

Commands:

- Run component tests: `npm run test -- tests/components`
- Watch mode: `npm run test:watch -- tests/components`

Notes:

- If a test needs `Canvas` environment, wrap components with the appropriate provider from `@react-three/fiber`.
- Keep tests resilient: avoid asserting on low-level rendering artifacts; instead assert behaviour and state.

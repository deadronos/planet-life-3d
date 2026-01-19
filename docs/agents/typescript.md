# TypeScript notes

## Vitest mocks: prefer strongly-typed signatures

When mocking functions that are passed as typed callbacks/props, prefer typed mocks.

- Example pattern: `vi.fn<(arg: SomeType) => void>()`

Rationale: untyped `vi.fn()` can fail `tsc -b` when used where a specific function type is required.

## Leva typing gotchas

If `tsc` reports errors like `Property 'running' does not exist on type 'FunctionReturnType<...>'`, it is usually caused by Leva’s complex return typings.

Pragmatic fixes:

- Cast the `useControls` result when destructuring (narrowly, near the callsite).
- Validate changes with `npm run typecheck` (fast), and use `npm run build` when you also need to validate bundling.

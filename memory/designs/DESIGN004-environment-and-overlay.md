# DESIGN004 — Space Environment & Overlay UX (Nebula, Sun, Moons, HUD, Onboarding)

**Goal**

- Provide a cohesive visual environment that complements planet rendering, and a lightweight overlay (HUD) and onboarding hint to improve first-time UX and developer feedback.

**Context & Constraints**

- The renderer is three.js via `@react-three/fiber`. Keep environment components optional and low-cost.
- HUD must be non-blocking, small, and testable with existing test harness. Onboarding must be one-time (localStorage flagged).
- Performance-sensitive: large scenes should not allocate or block the main tick loop.

**Design**

1. **Environment Components**
   - `NebulaSkybox`: procedural GLSL FBM skybox shader; lightweight and controlled by props.
   - `DistantSun`: distant sun sprite with size & glow parameters.
   - `DistantMoons`: simple orbiting meshes with small geometry and optional shadows.
   - `SunLensFlare`: simple sprite flare driven by `lightPosition`.
   - All composed by `SpaceEnvironment` for easy enable/disable.

2. **Overlay / HUD**
   - `Overlay` component reads `useUIStore` (Zustand) stats and renders small HUD rows for `Gen`, `Pop`, `Births`, `Deaths`.
   - Onboarding hint: displays once per browser (localStorage key `onboardingHintShown`) and is covered by unit tests.
   - Hotkey `h` toggles the Leva panel for quick iteration.

**Data Flow & Interfaces**

- `usePlanetLifeSim()` writes stats into `useUIStore.getState().setStats(...)` each tick.
- `Overlay` consumes these stats and updates UI; onboarding reads/writes `localStorage`.

**Validation Plan**

- Manual: Visual verification of environment and HUD; check onboarding shows once.
- Tests: `Overlay.test.tsx` verifies onboarding behavior and HUD rendering via mocked `localStorage`.

**Open Questions / Future Work**

- Expose environment tuning controls in Leva.
- Consider persisting HUD visibility and theme choices in `localStorage`.

// @vitest-environment jsdom
/**
 * Integration test: the real PlanetLife composition mounted in a real R3F
 * root (@react-three/test-renderer). Asserts the actual three.js scene graph
 * (planet, atmosphere, life overlay) and that a meteor is added to the scene
 * when the planet is clicked. Leva is replaced by a defaults-only stand-in and
 * `gl` by the shared fake; the reconciler, stores, hooks and materials are real.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createFakeGl } from '../unit/helpers/fakeGl';
import { levaMock } from '../unit/helpers/levaMock';

vi.mock('leva', () => levaMock);

const fake = createFakeGl({ async: false });
vi.doUnmock('@react-three/fiber');
vi.doMock('@react-three/fiber', async () => {
  const actual = await vi.importActual<typeof import('@react-three/fiber')>('@react-three/fiber');
  return {
    ...actual,
    useThree: ((selector?: (s: unknown) => unknown) => {
      const state = { ...actual.useThree(), gl: fake.gl };
      return selector ? selector(state) : state;
    }) as typeof actual.useThree,
  };
});

let create: typeof import('@react-three/test-renderer').create;
let act: typeof import('@react-three/test-renderer').act;

beforeAll(async () => {
  const rtr = await import('@react-three/test-renderer');
  create = rtr.create;
  act = rtr.act;
});

afterEach(() => vi.clearAllMocks());

async function mount() {
  const { default: React } = await import('react');
  const { PlanetLife } = await import('../../src/components/PlanetLife');
  return create(React.createElement(PlanetLife));
}

describe('PlanetLife (real R3F scene graph)', () => {
  it('builds planet, atmosphere and life-overlay spheres with real materials', async () => {
    const renderer = await mount();
    const meshes = renderer.scene.findAll((n) => n.type === 'Mesh');
    expect(meshes.length).toBeGreaterThanOrEqual(3);
    for (const m of meshes) {
      const mesh = m.instance as import('three').Mesh;
      expect(mesh.geometry.type).toBe('SphereGeometry');
      expect(mesh.material).toBeDefined();
    }
    // Overlay/atmosphere sit outside the planet, so radii are strictly increasing.
    const radii = meshes
      .map(
        (m) => (m.instance as import('three').Mesh).geometry as { parameters?: { radius: number } },
      )
      .map((g) => g.parameters?.radius ?? 0)
      .sort((a, b) => a - b);
    expect(radii[0]).toBeGreaterThan(0);
    expect(radii[radii.length - 1]).toBeGreaterThan(radii[0]);
    await renderer.unmount();
  });

  it('fires a meteor on click, then impacts the planet and fills the probe card', async () => {
    const THREE = await import('three');
    const { useUIStore } = await import('../../src/store/useUIStore');
    useUIStore.setState({ probe: undefined });

    const renderer = await mount();
    const meshCount = () => renderer.scene.findAll((n) => n.type === 'Mesh').length;
    const before = meshCount();
    const planet = renderer.scene.findAll(
      (n) => n.type === 'Mesh' && typeof n.props.onPointerDown === 'function',
    )[0];
    expect(planet).toBeDefined();

    await act(async () => {
      await renderer.fireEvent(planet, 'pointerDown', {
        point: new THREE.Vector3(0, 0, 2.6),
        camera: { position: new THREE.Vector3(0, 0, 8) },
      });
    });
    expect(meshCount()).toBeGreaterThan(before); // meteor head added

    // Fly the meteor into the planet; its impact seeds the world and sets the probe.
    await act(async () => {
      await renderer.advanceFrames(30, 0.1);
    });
    expect(useUIStore.getState().probe).toBeDefined();
    await renderer.unmount();
  });
});

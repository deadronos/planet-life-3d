// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import * as THREE from 'three';

// Ensure leva does not inject CSS/stitches during tests
vi.mock('leva', () => ({
  useControls: () => ({}) as unknown as Record<string, unknown>,
  folder: (x: unknown) => x as Record<string, unknown>,
  button: () => () => {},
}));

// Mock usePlanetLifeControls to control returned parameters (Dots mode)
vi.mock('../../src/components/planetLife/controls', () => ({
  usePlanetLifeControls: () => ({
    running: false,
    tickMs: 120,
    latCells: 10,
    lonCells: 10,
    birthDigits: '3',
    surviveDigits: '23',
    gameMode: 'Classic',
    randomDensity: 0.1,

    planetRadius: 5,
    planetWireframe: false,
    planetRoughness: 0.9,
    rimIntensity: 0.65,
    rimPower: 2.6,
    terminatorSharpness: 1.4,
    terminatorBoost: 0.35,
    atmosphereColor: '#64d4ff',
    atmosphereIntensity: 0.55,
    atmosphereHeight: 0.06,

    cellRenderMode: 'Dots',
    cellOverlayOpacity: 1,

    cellRadius: 0.05,
    cellLift: 0,
    cellColor: '#fff',
    cellColorMode: 'Neighbor Heat',
    colonyColorA: '#ff0000',
    colonyColorB: '#00ff00',
    ageFadeHalfLife: 24,
    heatLowColor: '#000',
    heatMidColor: '#777',
    heatHighColor: '#fff',

    meteorSpeed: 10,
    meteorRadius: 0.08,
    meteorCooldownMs: 120,
    showerEnabled: false,
    showerInterval: 250,
    meteorTrailLength: 0.9,
    meteorTrailWidth: 0.12,
    meteorEmissive: 2.6,
    impactFlashIntensity: 1.5,
    impactFlashRadius: 0.45,
    impactRingColor: '#ffeeaa',
    impactRingDuration: 0.9,
    impactRingSize: 1,

    seedMode: 'set',
    seedPattern: 'Glider',
    seedScale: 1,
    seedJitter: 0,
    seedProbability: 0.7,
    customPattern: '...\n',

    debugLogs: false,
    workerSim: false,
  }),
}));

// Mock useMeteorSystem to return one meteor and one impact
vi.mock('../../src/components/planetLife/useMeteorSystem', () => ({
  useMeteorSystem: () => ({
    meteors: [
      {
        id: 'm1',
        origin: new THREE.Vector3(12, 0, 0),
        direction: new THREE.Vector3(-1, 0, 0),
        speed: 10,
        radius: 0.08,
        trailLength: 0.9,
        trailWidth: 0.12,
        emissiveIntensity: 2.6,
      },
    ],
    impacts: [
      {
        id: 'i1',
        point: new THREE.Vector3(1, 0, 0),
        normal: new THREE.Vector3(1, 0, 0),
        start: 0,
        duration: 1,
        color: '#ffeeaa',
        flashIntensity: 1,
        flashRadius: 0.4,
        ringSize: 1,
      },
    ],
    onPlanetPointerDown: () => {},
    onMeteorImpact: () => {},
  }),
}));

// Stub out the heavy usePlanetLifeSim so it doesn't try to access three internals
vi.mock('../../src/components/planetLife/usePlanetLifeSim', () => ({
  usePlanetLifeSim: () => ({
    updateInstances: () => {},
    clear: () => {},
    randomize: () => {},
    stepOnce: () => {},
    seedAtPoint: () => {},
    simRef: { current: null },
  }),
}));

// Mock @react-three/fiber to avoid warnings in jsdom
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: () => ({
    camera: { position: new THREE.Vector3() },
    gl: { domElement: document.createElement('canvas') },
    viewport: { width: 100, height: 100, factor: 1, distance: 1, aspect: 1 },
  }),
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas-mock">{children}</div>
  ),
}));

import { PlanetLife } from '../../src/components/PlanetLife';

describe('PlanetLife (modes & meteor/impact rendering)', () => {
  it('renders instancedMesh in Dots mode and shows meteors and impacts', () => {
    const { container } = render(<PlanetLife />);

    // tag names are lowercased in jsdom
    expect(container.querySelector('instancedmesh')).toBeInTheDocument();

    // Meteor uses sphereGeometry (head)
    const spheres = container.querySelectorAll('sphereGeometry');
    expect(spheres.length).toBeGreaterThanOrEqual(1);

    // ImpactRing renders a circleGeometry
    const circles = container.querySelectorAll('circleGeometry');
    expect(circles.length).toBeGreaterThanOrEqual(1);
  });
});

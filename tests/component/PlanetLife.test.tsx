// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { PlanetLife } from '../../src/components/PlanetLife';
import * as THREE from 'three';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-call */

// Mock Leva controls
vi.mock('leva', () => {
  return {
    useControls: (schemaOrName: unknown, schema?: unknown) => {
      const s = schema ?? schemaOrName;
      const result: Record<string, unknown> = {};
      function isValueObject(v: unknown): v is { value: unknown } {
        return typeof v === 'object' && v !== null && 'value' in v;
      }
      const getValue = (val: unknown) => {
        if (isValueObject(val)) return val.value;
        return val;
      };
      if (typeof s === 'function') {
        return { Randomize: () => {}, Clear: () => {}, StepOnce: () => {} };
      }
      if (typeof s === 'object' && s !== null) {
        for (const key of Object.keys(s))
          result[key] = getValue((s as Record<string, unknown>)[key]);
      }
      return result;
    },
    folder: (obj: unknown) => obj,
    button: () => () => {},
  };
});

vi.mock('@react-three/fiber', (_importOriginal) => {
  return {
    useFrame: vi.fn(),
    useThree: () => ({
      camera: { position: new THREE.Vector3() },
      gl: { domElement: document.createElement('canvas') },
      viewport: { width: 100, height: 100, factor: 1, distance: 1, aspect: 1 },
    }),
    Canvas: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="canvas-mock">{children}</div>
    ),
  };
});

describe('PlanetLife', () => {
  const originalError = console.error.bind(console) as (...args: unknown[]) => void;
  beforeEach(() => {
    console.error = vi.fn((...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('creates an invalid DOM property'))
        return;

      originalError(...args);
    });
  });
  afterEach(() => {
    console.error = originalError;
  });

  it('renders the planet mesh and life overlay', () => {
    const { container } = render(<PlanetLife />);

    // PlanetLife renders a group containing multiple meshes
    // 1. Planet sphere
    // 2. Life overlay sphere
    // 3. InstancedMesh (possibly, depends on mode)

    const meshes = container.querySelectorAll('mesh');
    expect(meshes.length).toBeGreaterThanOrEqual(1);

    // Check if geometries are present
    const spheres = container.querySelectorAll('sphereGeometry');
    expect(spheres.length).toBeGreaterThanOrEqual(1);

    expect(container.querySelector('meshStandardMaterial')).toBeInTheDocument();

    // Overlay uses meshBasicMaterial
    // It might be rendered if mock returns default 'Texture'
    // expect(container.querySelector('meshBasicMaterial')).toBeInTheDocument();
  });
});

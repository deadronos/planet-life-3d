// @vitest-environment jsdom
import * as matchers from '@testing-library/jest-dom/matchers';
import { render } from '@testing-library/react';
import React from 'react';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PlanetLife } from '../../src/components/PlanetLife';

expect.extend(matchers);

/* eslint-disable no-console */

// Mock Leva controls
vi.mock('leva', () => {
  return {
    useControls: (schemaOrName: unknown, schema?: unknown) => {
      let s = schema ?? schemaOrName;
      // Leva's `folder()` takes a plain object and returns a wrapper, so the
      // schema has to be unwrapped before the value objects below are read.
      const isFunction = typeof s === 'function';
      if (isFunction) {
        s = (s as () => unknown)();
      }

      const result: Record<string, unknown> = {};
      function isValueObject(v: unknown): v is { value: unknown } {
        return typeof v === 'object' && v !== null && 'value' in v;
      }

      const isPlainObject = (v: unknown): v is Record<string, unknown> => {
        return typeof v === 'object' && v !== null && !Array.isArray(v);
      };

      const flattenSchema = (obj: Record<string, unknown>) => {
        for (const key of Object.keys(obj)) {
          const val = obj[key];
          if (isValueObject(val)) {
            result[key] = val.value;
            continue;
          }
          if (isPlainObject(val)) {
            // `folder()` returns a nested schema object; flatten it into the top-level result.
            // This matches how the component destructures the control values.
            flattenSchema(val);
            continue;
          }
          result[key] = val;
        }
      };

      if (typeof s === 'object' && s !== null) {
        flattenSchema(s as Record<string, unknown>);
      }

      if (isFunction) {
        return [result, () => {}];
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
    // 2. Atmosphere shell
    // 3. Life overlay sphere
    // 4. InstancedMesh (only in Dots/Both mode)

    const meshes = container.querySelectorAll('mesh');
    expect(meshes.length).toBeGreaterThanOrEqual(3);

    // Each of those spheres carries its own geometry.
    const spheres = container.querySelectorAll('sphereGeometry');
    expect(spheres.length).toBeGreaterThanOrEqual(3);

    // Default render mode is Texture, so the life cells are drawn onto the
    // overlay texture and no instancedMesh is created.
    // (Previously this asserted on `meshBasicMaterial`, which was actually the
    // atmosphere's material rather than the overlay's - an implementation
    // detail that changed when the atmosphere gained its fresnel shader.)
    expect(container.querySelector('instancedMesh')).not.toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { PlanetLife } from '../../src/components/PlanetLife';
import * as THREE from 'three';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

/* eslint-disable no-console */

// Mock Leva controls
vi.mock('leva', () => {
  return {
    useControls: (...args: unknown[]) => {
      let schema: unknown;
      // Handle signatures:
      // useControls(schema)
      // useControls(name, schema)
      // useControls(schema, deps)
      // useControls(name, schema, deps)
      if (typeof args[0] === 'string') {
        schema = args[1];
      } else {
        schema = args[0];
      }

      let s = schema;
      const isFunction = typeof s === 'function';
      if (isFunction) {
        s = (s as Function)();
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
            flattenSchema(val);
            continue;
          }
          result[key] = val;
        }
      };

      if (typeof s === 'object' && s !== null) {
        flattenSchema(s as Record<string, unknown>);
      }

      // Always return [values, set] if the schema was a function (standard useControls pattern in this codebase)
      // Or if we are mocking based on usage.
      // The error was "object is not iterable", meaning `useControls` returned an object instead of array.
      // In `controls.ts`, both calls use function schema: `useControls('Debug', () => ...)` and `useControls(() => ...)`
      // So checking `isFunction` should be enough, provided we extracted `schema` correctly.

      // If schema was extracted correctly (it's the function), isFunction is true.

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
    // 2. Life overlay sphere
    // 3. InstancedMesh (possibly, depends on mode)

    const meshes = container.querySelectorAll('mesh');
    expect(meshes.length).toBeGreaterThanOrEqual(1);

    // Check if geometries are present
    const spheres = container.querySelectorAll('sphereGeometry');
    expect(spheres.length).toBeGreaterThanOrEqual(1);

    // Default render mode is Texture, so we expect the overlay material.
    // (meshStandardMaterial is only present when Dots/Both mode renders the instanced mesh.)
    expect(container.querySelector('meshBasicMaterial')).toBeInTheDocument();
    expect(container.querySelector('instancedMesh')).not.toBeInTheDocument();
  });
});

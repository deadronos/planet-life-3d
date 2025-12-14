// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import * as THREE from 'three';
import { ImpactRing } from '../../src/components/ImpactRing';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

/* eslint-disable no-console */

// Mock @react-three/fiber locally to ensure it works
vi.mock('@react-three/fiber', (_importOriginal) => {
  return {
    useFrame: vi.fn(),
    useThree: () => ({
      camera: { position: new THREE.Vector3() },
      gl: { domElement: document.createElement('canvas') },
      viewport: { width: 100, height: 100, factor: 1, distance: 1, aspect: 1 },
    }),
    Canvas: (props: { children?: React.ReactNode }) => (
      <div data-testid="canvas-mock">{props.children}</div>
    ),
  };
});

describe('ImpactRing', () => {
  // Suppress console.error for unrecognized elements (mesh, geometry, etc.)
  const originalError = console.error.bind(console) as (...args: unknown[]) => void;
  beforeEach(() => {
    console.error = vi.fn((...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('creates an invalid DOM property'))
        return;
      if (typeof args[0] === 'string' && args[0].includes('property classID')) return; // Three.js internals

      originalError(...args);
    });
  });
  afterEach(() => {
    console.error = originalError;
  });

  it('renders a mesh element', () => {
    const spec = {
      id: 'test-impact',
      point: new THREE.Vector3(1, 0, 0),
      normal: new THREE.Vector3(1, 0, 0),
      start: 0,
      duration: 1,
      color: '#ffeeaa',
      flashIntensity: 1,
      flashRadius: 0.4,
      ringSize: 1,
    };

    const { container } = render(<ImpactRing spec={spec} planetRadius={10} />);

    // In jsdom, <mesh> becomes a 'mesh' tag
    expect(container.querySelector('mesh')).toBeInTheDocument();
    expect(container.querySelector('ringGeometry')).toBeInTheDocument();
  });
});

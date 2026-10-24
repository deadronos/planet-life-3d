// @vitest-environment jsdom
import * as matchers from '@testing-library/jest-dom/matchers';
import { render } from '@testing-library/react';
import React from 'react';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Meteor } from '../../src/components/Meteor';
import type { MeteorSpec } from '../../src/components/meteorTypes';

expect.extend(matchers);

/* eslint-disable no-console */

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

describe('Meteor', () => {
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

  it('renders a sphere mesh', () => {
    const spec: MeteorSpec = {
      id: 'm1',
      origin: new THREE.Vector3(10, 0, 0),
      direction: new THREE.Vector3(-1, 0, 0),
      speed: 1,
      radius: 0.5,
      trailLength: 0.6,
      trailWidth: 0.1,
      emissiveIntensity: 1.2,
      source: 'user',
    };

    const { container } = render(<Meteor spec={spec} planetRadius={5} onImpact={() => {}} />);

    expect(container.querySelector('mesh')).toBeInTheDocument();
    expect(container.querySelector('sphereGeometry')).toBeInTheDocument();
  });
});

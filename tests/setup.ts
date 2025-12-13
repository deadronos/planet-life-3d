import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import * as THREE from 'three';
import React from 'react';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

// Mock ResizeObserver
(globalThis as unknown as Record<string, unknown>)['ResizeObserver'] = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock @react-three/fiber for standard DOM testing
vi.mock('@react-three/fiber', (_importOriginal) => {
  // We don't import actual because we want to fully replace the context hooks
  return {
    useFrame: vi.fn(),
    useThree: () => ({
      camera: new THREE.PerspectiveCamera(),
      scene: new THREE.Scene(),
      gl: {
        domElement: document.createElement('canvas'),
      },
      viewport: { width: 100, height: 100, factor: 1, distance: 1, aspect: 1 },
    }),
    Canvas: (props: { children?: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'canvas-mock' }, props.children),
    // Add other exports if needed
    // The Canvas signature uses a plain props parameter to avoid TypeScript-only syntax that destructures typed params in some parsers.
  };
});

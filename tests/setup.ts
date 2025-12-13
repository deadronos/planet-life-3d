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

// Globally filter out a few React warnings that are benign in a jsdom environment
// when rendering react-three-fiber components (these components are normally
// handled by the runtime renderer rather than DOM). The warnings are noisy
// and expected in the tests — we filter only the specific messages.
const _origConsoleError = console.error.bind(console);
console.error = ((...args: unknown[]) => {
  const text = args
    .map((a) => {
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');

  const msg = text;
  const threeTags = [
    'mesh',
    'group',
    'sphereGeometry',
    'ringGeometry',
    'meshStandardMaterial',
    'meshBasicMaterial',
    'primitive',
  ];
  const casingWarning = msg.includes('is using incorrect casing');
  const unrecognizedWarning = msg.includes('is unrecognized in this browser');
  const nonBooleanAttr = msg.includes('Received `true` for a non-boolean attribute');
  const threeAttr = threeTags.some((t) => msg.includes(`<${t}`) || msg.includes(t));
  const depthOrEmissive =
    (msg.includes('depthWrite') ||
      msg.includes('emissiveIntensity') ||
      msg.includes('transparent')) &&
    msg.includes('React does not recognize the');
  const invalidDom =
    msg.includes('creates an invalid DOM property') || msg.includes('property classID');

  // Suppress known react-three/three warnings encountered in jsdom tests. The
  // filter intentionally leans broader because React uses different phrasing
  // depending on build/runtime. The filter is still scoped to the React DOM
  // warnings or three.js props to avoid hiding unrelated errors.
  if (casingWarning || unrecognizedWarning || nonBooleanAttr || invalidDom || depthOrEmissive) {
    // If this is not clearly related to three.js tags, allow it.
    if (
      threeAttr ||
      msg.includes('depthWrite') ||
      msg.includes('emissiveIntensity') ||
      msg.includes('transparent')
    )
      return;
  }

  // Additionally, suppress specific three.js attribute warnings that react DOM emits
  if (
    msg.includes('transparent') ||
    msg.includes('depthWrite') ||
    msg.includes('emissiveIntensity')
  )
    return;

  _origConsoleError(...(args as [unknown, ...unknown[]]));
}) as unknown as typeof console.error;

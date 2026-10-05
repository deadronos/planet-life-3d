// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression guards for the dependency-array invariants in GPUSimulation.
 *
 * The component deliberately omits `rules`, `gameMode` and `randomDensity`
 * from several dependency lists. Adding any of them recreates the shader
 * material, which changes `initializeState`, which re-fires the init effect
 * and wipes a running simulation. That happens on every keystroke in the
 * birth/survive digit fields, so it is silent and very easy to reintroduce.
 */

const glMock = {
  domElement: document.createElement('canvas'),
  clear: vi.fn(),
  render: vi.fn(),
  setRenderTarget: vi.fn(),
  getRenderTarget: vi.fn(() => null),
  readRenderTargetPixels: vi.fn(),
};

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: () => ({ gl: glMock }),
  useImperativeHandle: (ref: unknown, factory: () => unknown) => {
    if (ref && typeof ref === 'object' && 'current' in ref) {
      ref.current = factory();
    }
  },
}));

import { GPUSimulation } from '../../src/components/GPUSimulation';

const RULES_A = {
  birth: [false, false, true, false, false, false, false, false, false],
  survive: [false, true, true, false, false, false, false, false, false],
};
const RULES_B = {
  birth: [false, false, false, true, false, false, false, false, false],
  survive: [false, false, true, true, false, false, false, false, false],
};

beforeEach(() => {
  glMock.clear.mockClear();
  glMock.render.mockClear();
  glMock.setRenderTarget.mockClear();
});

describe('GPUSimulation initialization invariants', () => {
  it('initializes once on mount', () => {
    render(<GPUSimulation rules={RULES_A} />);
    // initializeState clears both ping-pong buffers.
    expect(glMock.clear).toHaveBeenCalledTimes(2);
  });

  it('does NOT re-initialize when the rules change', () => {
    const { rerender } = render(<GPUSimulation rules={RULES_A} />);
    expect(glMock.clear).toHaveBeenCalledTimes(2);

    rerender(<GPUSimulation rules={RULES_B} />);
    expect(glMock.clear).toHaveBeenCalledTimes(2);
  });

  it('does NOT re-initialize when gameMode toggles', () => {
    const { rerender } = render(<GPUSimulation rules={RULES_A} gameMode="Classic" />);
    rerender(<GPUSimulation rules={RULES_A} gameMode="Colony" />);
    expect(glMock.clear).toHaveBeenCalledTimes(2);
  });

  it('does NOT re-initialize when randomDensity changes', () => {
    const { rerender } = render(<GPUSimulation rules={RULES_A} randomDensity={0.1} />);
    rerender(<GPUSimulation rules={RULES_A} randomDensity={0.9} />);
    expect(glMock.clear).toHaveBeenCalledTimes(2);
  });

  it('does NOT re-initialize when ecologyProfile changes', () => {
    const { rerender } = render(<GPUSimulation rules={RULES_A} ecologyProfile="None" />);
    rerender(<GPUSimulation rules={RULES_A} ecologyProfile="Garden World" />);
    expect(glMock.clear).toHaveBeenCalledTimes(2);
  });

  it('DOES re-initialize when the resolution changes', () => {
    // The flip side of the invariant: new render targets mean the world must
    // be seeded, so a resolution change is the one case that should reset.
    const { rerender } = render(
      <GPUSimulation rules={RULES_A} resolution={{ width: 64, height: 64 }} />,
    );
    expect(glMock.clear).toHaveBeenCalledTimes(2);

    rerender(<GPUSimulation rules={RULES_A} resolution={{ width: 128, height: 128 }} />);
    expect(glMock.clear).toHaveBeenCalledTimes(4);
  });

  it('survives a rules change without throwing', () => {
    const { rerender } = render(<GPUSimulation rules={RULES_A} />);
    expect(() => rerender(<GPUSimulation rules={RULES_B} />)).not.toThrow();
  });
});

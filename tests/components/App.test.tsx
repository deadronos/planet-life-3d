import { render, fireEvent, screen } from '@testing-library/react';
import App from '../../src/App';
import { vi, describe, it, expect } from 'vitest';

// Mock Leva
vi.mock('leva', () => ({
  Leva: vi.fn(({ hidden }: { hidden?: boolean }) => (
    <div data-testid="leva" hidden={hidden}>
      Leva Panel
    </div>
  )),
  useControls: vi.fn().mockReturnValue({}),
  folder: vi.fn(),
  button: vi.fn(),
}));

// Mock child components
vi.mock('../../src/components/PlanetLife', () => ({
  PlanetLife: () => null,
}));

vi.mock('../../src/components/Overlay', () => ({
  Overlay: () => null,
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Stars: () => null,
}));

// Mock SpaceEnvironment
vi.mock('../../src/components/environment', () => ({
  SpaceEnvironment: () => null,
}));

// Mock Canvas to avoid rendering 3D elements that cause warnings in JSDOM
vi.mock('@react-three/fiber', () => ({
  Canvas: () => null,
}));

describe('App Hotkeys', () => {
  it('toggles Leva visibility when pressing "h"', () => {
    render(<App />);

    const levaPanel = screen.getByTestId('leva');

    // Initial state: visible (hidden should be undefined or false)
    expect(levaPanel).not.toHaveAttribute('hidden');

    // Press 'h'
    fireEvent.keyDown(window, { key: 'h' });

    // Should be hidden
    expect(levaPanel).toHaveAttribute('hidden');

    // Press 'h' again
    fireEvent.keyDown(window, { key: 'h' });

    // Should be visible
    expect(levaPanel).not.toHaveAttribute('hidden');
  });

  it('toggles Leva visibility when pressing "H"', () => {
    render(<App />);

    const levaPanel = screen.getByTestId('leva');

    // Initial state: visible
    expect(levaPanel).not.toHaveAttribute('hidden');

    // Press 'H'
    fireEvent.keyDown(window, { key: 'H' });

    // Should be hidden
    expect(levaPanel).toHaveAttribute('hidden');
  });
});

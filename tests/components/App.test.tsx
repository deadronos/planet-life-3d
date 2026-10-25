import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import App from '../../src/App';

// Mock the lazily loaded Leva panel
vi.mock('../../src/components/LevaPanel', () => ({
  default: ({ hidden }: { hidden?: boolean }) => (
    <div data-testid="leva" hidden={hidden}>
      Leva Panel
    </div>
  ),
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
  it('does not mount the Leva panel on first render', () => {
    render(<App />);
    expect(screen.queryByTestId('leva')).toBeNull();
  });

  it('loads the Leva panel after first paint', async () => {
    render(<App />);
    expect(await screen.findByTestId('leva')).not.toHaveAttribute('hidden');
  });

  it('toggles Leva visibility when pressing "h"', async () => {
    render(<App />);

    const levaPanel = await screen.findByTestId('leva');
    expect(levaPanel).not.toHaveAttribute('hidden');

    fireEvent.keyDown(window, { key: 'h' });
    expect(levaPanel).toHaveAttribute('hidden');

    fireEvent.keyDown(window, { key: 'h' });
    expect(levaPanel).not.toHaveAttribute('hidden');
  });

  it('toggles Leva visibility when pressing "H"', async () => {
    render(<App />);

    const levaPanel = await screen.findByTestId('leva');
    expect(levaPanel).not.toHaveAttribute('hidden');

    fireEvent.keyDown(window, { key: 'H' });
    expect(levaPanel).toHaveAttribute('hidden');
  });
});

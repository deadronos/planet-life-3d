import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TransportBar } from '../../src/components/TransportBar';
import { useUIStore } from '../../src/store/useUIStore';

describe('TransportBar', () => {
  beforeEach(() => {
    act(() => {
      useUIStore.setState({
        simRunning: true,
        simTickMs: 120,
        simCommand: undefined,
        simSpeedRequest: undefined,
      });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it.each([
    ['Run simulation', 'togglePlay'],
    ['Step one generation', 'step'],
    ['Randomize grid', 'randomize'],
    ['Clear grid', 'clear'],
  ])('%s dispatches %s through the command bus', (label, command) => {
    render(<TransportBar />);
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(useUIStore.getState().simCommand?.command).toBe(command);
  });

  it('reflects running state on the play button via aria-pressed and its label', () => {
    render(<TransportBar />);
    const play = screen.getByRole('button', { name: 'Run simulation' });
    expect(play).toHaveAttribute('aria-pressed', 'true');
    expect(play).toHaveTextContent('Pause');

    act(() => useUIStore.getState().setSimPlayback({ running: false, tickMs: 120 }));
    expect(play).toHaveAttribute('aria-pressed', 'false');
    expect(play).toHaveTextContent('Play');
  });

  it('writes tickMs through the speed request when the slider moves', () => {
    render(<TransportBar />);
    const slider = screen.getByRole('slider', { name: 'Speed' });
    // Right is faster: slider value 1510 - tickMs.
    fireEvent.change(slider, { target: { value: '1010' } });
    expect(useUIStore.getState().simSpeedRequest?.tickMs).toBe(500);
    expect(useUIStore.getState().simTickMs).toBe(500);
  });

  it('shows the slider position from the mirrored tickMs', () => {
    act(() => useUIStore.getState().setSimPlayback({ running: true, tickMs: 500 }));
    render(<TransportBar />);
    expect(screen.getByRole('slider', { name: 'Speed' })).toHaveValue('1010');
  });
});

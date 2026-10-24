import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  SLIDER_STEPS,
  sliderToTickMs,
  TICK_MS_MAX,
  TICK_MS_MIN,
  tickMsToSlider,
  TransportBar,
} from '../../src/components/TransportBar';
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
    ['Pause simulation', 'togglePlay'],
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
    const pause = screen.getByRole('button', { name: 'Pause simulation' });
    expect(pause).toHaveAttribute('aria-pressed', 'true');
    expect(pause).toHaveTextContent('Pause');

    act(() => useUIStore.getState().setSimPlayback({ running: false, tickMs: 120 }));
    const play = screen.getByRole('button', { name: 'Play simulation' });
    expect(play).toHaveAttribute('aria-pressed', 'false');
    expect(play).toHaveTextContent('Play');
  });

  it('writes tickMs through the speed request when the slider moves', () => {
    render(<TransportBar />);
    const slider = screen.getByRole('slider', { name: 'Speed' });
    const value = tickMsToSlider(500);
    fireEvent.change(slider, { target: { value: String(value) } });
    expect(useUIStore.getState().simSpeedRequest?.tickMs).toBe(sliderToTickMs(value));
    expect(useUIStore.getState().simTickMs).toBe(sliderToTickMs(value));
  });

  it('shows the slider position from the mirrored tickMs', () => {
    act(() => useUIStore.getState().setSimPlayback({ running: true, tickMs: 500 }));
    render(<TransportBar />);
    expect(screen.getByRole('slider', { name: 'Speed' })).toHaveValue(String(tickMsToSlider(500)));
  });

  it('maps endpoints exactly', () => {
    expect(sliderToTickMs(0)).toBe(TICK_MS_MAX);
    expect(sliderToTickMs(SLIDER_STEPS)).toBe(TICK_MS_MIN);
    expect(tickMsToSlider(TICK_MS_MAX)).toBe(0);
    expect(tickMsToSlider(TICK_MS_MIN)).toBe(SLIDER_STEPS);
  });

  it('places the default 120ms in the log range (about halfway, 0.50)', () => {
    const v = tickMsToSlider(120) / SLIDER_STEPS;
    expect(v).toBeGreaterThan(0.45);
    expect(v).toBeLessThan(0.55);
  });

  it('is monotonic and round-trips within 1ms', () => {
    let prev = -Infinity;
    for (let v = 0; v <= SLIDER_STEPS; v += 1) {
      const tickMs = sliderToTickMs(v);
      expect(tickMs).toBeLessThanOrEqual(prev === -Infinity ? TICK_MS_MAX : prev);
      prev = tickMs;
    }
    for (let tickMs = TICK_MS_MIN; tickMs <= TICK_MS_MAX; tickMs += 7) {
      expect(Math.abs(sliderToTickMs(tickMsToSlider(tickMs)) - tickMs)).toBeLessThanOrEqual(1);
    }
  });
});

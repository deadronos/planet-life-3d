import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/clipboard', () => ({ copyText: vi.fn() }));

import {
  SLIDER_STEPS,
  sliderToTickMs,
  SPEED_RATIO_PER_STEP,
  TICK_MS_MAX,
  TICK_MS_MIN,
  tickMsToSlider,
  TransportBar,
} from '../../src/components/TransportBar';
import { useUIStore } from '../../src/store/useUIStore';
import { copyText } from '../../src/utils/clipboard';

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

  it('is monotonic and round-trips within 1ms or 2% of the value', () => {
    let prev = -Infinity;
    for (let v = 0; v <= SLIDER_STEPS; v += 1) {
      const tickMs = sliderToTickMs(v);
      expect(tickMs).toBeLessThanOrEqual(prev === -Infinity ? TICK_MS_MAX : prev);
      prev = tickMs;
    }
    // One slider step is ~2% of speed, so the round trip is only as exact as that.
    for (let tickMs = TICK_MS_MIN; tickMs <= TICK_MS_MAX; tickMs += 7) {
      const error = Math.abs(sliderToTickMs(tickMsToSlider(tickMs)) - tickMs);
      expect(error).toBeLessThanOrEqual(Math.max(1, tickMs * 0.02));
    }
  });

  it('makes one arrow-key press change speed by about 2%', () => {
    expect(SPEED_RATIO_PER_STEP).toBeGreaterThan(1.015);
    expect(SPEED_RATIO_PER_STEP).toBeLessThan(1.025);
    render(<TransportBar />);
    const slider = screen.getByRole('slider', { name: 'Speed' });
    expect(slider).toHaveAttribute('step', '1');
    expect(slider).toHaveAttribute('max', String(SLIDER_STEPS));
  });

  // #178: Copy link is an icon button beside Speed, so it never adds a row.
  describe('Copy link', () => {
    it('is an icon-only button with an accessible name', () => {
      render(<TransportBar />);
      const button = screen.getByRole('button', { name: 'Copy link to this world' });
      expect(button).toHaveClass('transport-icon-button');
      expect(button.textContent).toBe('');
    });

    it('shows the copied state and announces it after a successful copy', async () => {
      vi.mocked(copyText).mockResolvedValue(true);
      render(<TransportBar />);
      const button = screen.getByRole('button', { name: 'Copy link to this world' });
      // Flush the async copy before asserting.
      await act(() => {
        fireEvent.click(button);
        return Promise.resolve();
      });
      expect(button).toHaveAttribute('title', 'Copied');
      // <output> is also role=status, so target the live region explicitly.
      expect(document.querySelector('.sr-only[role="status"]')).toHaveTextContent('Link copied');
    });

    it('announces the fallback when the copy fails', async () => {
      vi.mocked(copyText).mockResolvedValue(false);
      render(<TransportBar />);
      const button = screen.getByRole('button', { name: 'Copy link to this world' });
      // Flush the async copy before asserting.
      await act(() => {
        fireEvent.click(button);
        return Promise.resolve();
      });
      expect(button).toHaveAttribute('title', 'Copy link');
      expect(document.querySelector('.sr-only[role="status"]')).toHaveTextContent('Copy failed');
    });
  });
});

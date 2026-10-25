import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasErrorBoundary } from '../../src/components/CanvasErrorBoundary';
import { GraphicsNotice } from '../../src/components/GraphicsNotice';
import {
  CONTEXT_RESTORE_TIMEOUT_MS,
  GraphicsRecovery,
} from '../../src/components/GraphicsRecovery';
import { useUIStore } from '../../src/store/useUIStore';

const canvas = document.createElement('canvas');
vi.mock('@react-three/fiber', () => ({
  useThree: (sel: (s: unknown) => unknown) => sel({ gl: { domElement: canvas } }),
}));

describe('CanvasErrorBoundary', () => {
  it('renders the fallback with a Reload button when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Boom = () => {
      throw new Error('no webgl');
    };
    render(
      <CanvasErrorBoundary>
        <Boom />
      </CanvasErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('no webgl');
    const reload = screen.getByRole('button', { name: 'Reload' });
    expect(reload).toBeTruthy();
    expect(reload).toHaveClass('transport-button');
    vi.restoreAllMocks();
  });
});

describe('context loss handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUIStore.setState({ graphicsStatus: 'ok', graphicsEpoch: 0, simRunning: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('pauses with a notice on loss, then recovers and bumps the epoch on restore', () => {
    render(
      <>
        <GraphicsRecovery />
        <GraphicsNotice />
      </>,
    );
    const lost = new Event('webglcontextlost', { cancelable: true });
    act(() => {
      canvas.dispatchEvent(lost);
    });
    expect(lost.defaultPrevented).toBe(true);
    expect(useUIStore.getState().graphicsStatus).toBe('lost');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Graphics context lost — trying to recover. The simulation will restart.',
    );
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
    // The user's own play/pause state is never touched.
    expect(useUIStore.getState().simRunning).toBe(true);

    act(() => {
      canvas.dispatchEvent(new Event('webglcontextrestored'));
    });
    expect(useUIStore.getState().graphicsStatus).toBe('ok');
    expect(useUIStore.getState().graphicsEpoch).toBe(1);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('offers Reload when not restored in time, and removes listeners on unmount', () => {
    const { unmount } = render(
      <>
        <GraphicsRecovery />
        <GraphicsNotice />
      </>,
    );
    act(() => {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
      vi.advanceTimersByTime(CONTEXT_RESTORE_TIMEOUT_MS + 1);
    });
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();

    unmount();
    useUIStore.setState({ graphicsStatus: 'ok' });
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(useUIStore.getState().graphicsStatus).toBe('ok');
  });
});

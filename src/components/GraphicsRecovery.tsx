import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

import { useUIStore } from '../store/useUIStore';

/** How long to wait for the browser to restore a lost context before offering Reload. */
export const CONTEXT_RESTORE_TIMEOUT_MS = 5000;

/**
 * Tracks WebGL context loss/restore on the canvas. Pausing is expressed through
 * `graphicsStatus` (not the Leva `running` control), so the user's own
 * play/pause choice is untouched and playback resumes automatically.
 */
export function GraphicsRecovery() {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clearTimer = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };

    const onLost = (event: Event) => {
      // Without this the browser never fires webglcontextrestored.
      event.preventDefault();
      useUIStore.getState().setGraphicsStatus('lost');
      clearTimer();
      timer = setTimeout(() => {
        if (useUIStore.getState().graphicsStatus === 'lost') {
          useUIStore.getState().setGraphicsStatus('stalled');
        }
      }, CONTEXT_RESTORE_TIMEOUT_MS);
    };

    const onRestored = () => {
      clearTimer();
      const store = useUIStore.getState();
      // Remount GL-owned resources (render targets, materials) from scratch.
      store.bumpGraphicsEpoch();
      store.setGraphicsStatus('ok');
    };

    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      clearTimer();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [gl]);

  return null;
}

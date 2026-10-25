import { useUIStore } from '../store/useUIStore';

/** Non-blocking notice shown while the WebGL context is lost. */
export function GraphicsNotice() {
  const status = useUIStore((state) => state.graphicsStatus);
  if (status === 'ok') return null;
  return (
    <div className="graphics-notice" role="status" aria-live="polite">
      <p>Graphics context lost — trying to recover…</p>
      {status === 'stalled' && (
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      )}
    </div>
  );
}

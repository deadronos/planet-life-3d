import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches errors thrown while creating or rendering the 3D canvas (no WebGL,
 * shader compile failures, ...) so the overlay stays usable and the user gets
 * an explanation instead of a black screen.
 */
export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('3D canvas failed', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="graphics-fallback" role="alert">
        <h2>The 3D view couldn&apos;t start</h2>
        <p>Your browser or device may not support WebGL, or the graphics driver hit an error.</p>
        <p className="graphics-detail">{error.message}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}

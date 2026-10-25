import { useThree } from '@react-three/fiber';
import { type ComponentType, lazy, Suspense, useMemo } from 'react';

import { useUIStore } from '../../store/useUIStore';
import { type BloomSettings, maxDprFor, shouldRenderBloom } from './bloomSettings';

function NoBloom() {
  return null;
}

/**
 * Wraps the chunk import so a failed load (a stale chunk 404ing after a
 * deploy, or the dev server optimising deps mid-request) degrades to no bloom
 * instead of rejecting into CanvasErrorBoundary and taking the whole 3D view
 * down. `lazy` caches the settled promise, so there is one warning and no
 * retry loop; a reload tries again.
 */
export function loadBloomEffects(
  load: () => Promise<{ default: ComponentType<Omit<BloomSettings, 'enabled'>> }>,
) {
  return load().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.warn('[bloom] Failed to load the bloom effects chunk; rendering without bloom.', error);
    return { default: NoBloom };
  });
}

// Loaded on first use so postprocessing stays out of first-load JS, and never
// downloaded at all on devices where bloom is off.
const BloomEffects = lazy(() => loadBloomEffects(() => import('./BloomEffects')));

/**
 * Mounts the bloom composer while it is enabled and the adaptive scaler has
 * not had to cut the pixel ratio. Unmounting restores the renderer's own tone
 * mapping; raw shaders look identical either way, and built-in materials only
 * differ above 1.0, where the glow takes over.
 */
export function SelectiveBloom({ enabled, intensity, threshold, radius }: BloomSettings) {
  const dpr = useThree((state) => state.viewport.dpr);
  // Remount after a WebGL context restore so render targets are recreated.
  const graphicsEpoch = useUIStore((state) => state.graphicsEpoch);
  const maxDpr = useMemo(
    () => maxDprFor(true, typeof window !== 'undefined' ? window.devicePixelRatio : 1),
    [],
  );

  if (!shouldRenderBloom(enabled, dpr, maxDpr)) return null;

  return (
    <Suspense fallback={null}>
      <BloomEffects
        key={graphicsEpoch}
        intensity={intensity}
        threshold={threshold}
        radius={radius}
      />
    </Suspense>
  );
}

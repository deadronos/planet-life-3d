import { useThree } from '@react-three/fiber';
import { lazy, Suspense, useMemo } from 'react';

import { useUIStore } from '../../store/useUIStore';
import { type BloomSettings, maxDprFor, shouldRenderBloom } from './bloomSettings';

// Loaded on first use so postprocessing stays out of first-load JS, and never
// downloaded at all on devices where bloom is off.
const BloomEffects = lazy(() => import('./BloomEffects'));

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

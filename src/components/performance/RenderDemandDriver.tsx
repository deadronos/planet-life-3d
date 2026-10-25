import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';

import { useDocumentHidden } from '../../hooks/useDocumentHidden';
import { useControlsStore } from '../../store/useControlsStore';
import { useUIStore } from '../../store/useUIStore';
import { needsContinuousRender } from './renderDemand';

/**
 * Drives the `frameloop="demand"` Canvas. While anything animates on its own it
 * re-invalidates every frame (identical to a continuous loop); otherwise no frame
 * is scheduled until something changes. OrbitControls (including damping),
 * React prop changes and resizes already invalidate through R3F/drei.
 */
export function RenderDemandDriver({ autoRotate }: { autoRotate: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const hidden = useDocumentHidden();
  const simRunning = useUIStore((s) => s.simRunning);
  const activeEffects = useUIStore((s) => s.activeEffectCount);
  const continuous = needsContinuousRender({
    simRunning,
    autoRotate,
    activeEffects,
    documentHidden: hidden,
  });
  useFrame(() => {
    if (continuous) invalidate();
  });

  // Kick the loop when continuous rendering starts, and render the final state when it stops.
  useEffect(() => {
    invalidate();
  }, [continuous, invalidate]);

  // Stats, probe, planet status, graphics status etc. all change what is drawn.
  useEffect(() => useUIStore.subscribe(() => invalidate()), [invalidate]);

  // Control edits reach materials through effects (uniforms), not R3F props, so they
  // would not redraw an idle canvas on their own.
  useEffect(() => useControlsStore.subscribe(() => invalidate()), [invalidate]);

  return null;
}

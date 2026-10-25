import { useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useEffect } from 'react';

import type { BloomSettings } from './bloomSettings';

/**
 * Bloom-only post-processing chain.
 *
 * EffectComposer sets `gl.toneMapping = NoToneMapping` while mounted, so the
 * scene renders linear HDR into a half-float target and the final pass only
 * sRGB-encodes (from `gl.outputColorSpace`). There is deliberately no
 * ToneMapping effect: most of the scene (planet, cell overlay, nebula,
 * atmosphere) uses raw ShaderMaterials that never received ACES on the canvas
 * path either, and a global ACES pass crushes their darks. With no tone
 * mapping in the chain, bloom-on matches bloom-off apart from the glow; the
 * few built-in materials lose ACES roll-off only above 1.0, which is exactly
 * where the bloom now takes over.
 *
 * The composer renders only when R3F runs a frame, so `frameloop="demand"`
 * stays on-demand. It checks the renderer size and pixel ratio every frame
 * and resizes its targets itself, so adaptive DPR needs no remount.
 */
export default function BloomEffects({
  intensity,
  threshold,
  radius,
}: Omit<BloomSettings, 'enabled'>) {
  const invalidate = useThree((state) => state.invalidate);
  // The chunk arrives asynchronously; with the on-demand loop idle nothing
  // else would draw the first composited frame (or the last plain one).
  useEffect(() => {
    invalidate();
    return () => invalidate();
  }, [invalidate]);

  return (
    // MSAA off: on half-float targets it multiplies the pass cost on high-DPR
    // screens, where the aliasing it hides is least visible.
    <EffectComposer multisampling={0}>
      <Bloom
        mipmapBlur
        intensity={intensity}
        luminanceThreshold={threshold}
        luminanceSmoothing={0.2}
        radius={radius}
      />
    </EffectComposer>
  );
}

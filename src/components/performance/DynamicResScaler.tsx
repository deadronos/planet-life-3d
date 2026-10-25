import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';

import {
  type AdaptiveResolutionConfig,
  decideNextDpr,
  DEFAULT_ADAPTIVE_RESOLUTION_CONFIG,
  FrameRateWindow,
} from './adaptiveResolution';
import { IDLE_GAP_SECONDS } from './renderDemand';

/**
 * Frames ignored right after a pixel-ratio change. Resizing reallocates every
 * render target (the bloom composer's half-float mip chain included), so the
 * next frame or two are slow for reasons that say nothing about the new
 * resolution. Counting them would trigger another step and the scaler would
 * oscillate between two ratios.
 */
export const SETTLE_FRAMES_AFTER_CHANGE = 3;

export interface DynamicResScalerProps {
  /** Master switch; when false the scaler never touches the pixel ratio. */
  enabled?: boolean;
  config?: AdaptiveResolutionConfig;
  /** Called whenever the scaler changes the pixel ratio. */
  onChange?: (dpr: number) => void;
}

/**
 * Lowers the renderer's pixel ratio when the frame rate cannot be sustained,
 * and restores it once there is headroom again.
 *
 * Mounted inside the Canvas so it can read the R3F store. The per-frame work
 * is a single push into a fixed-size ring buffer plus an arithmetic
 * comparison, and a pixel ratio only changes at most once per cooldown.
 */
export function DynamicResScaler({
  enabled = true,
  config = DEFAULT_ADAPTIVE_RESOLUTION_CONFIG,
  onChange,
}: DynamicResScalerProps) {
  const setDpr = useThree((state) => state.setDpr);
  // A live getter, not a subscription: the scaler must observe the dpr that is
  // actually in effect rather than a cached copy.
  //
  // R3F re-applies the Canvas `dpr` prop during prop reconciliation, so the
  // stored value can change without this component being involved (a resize,
  // browser zoom, or a re-render). Caching would desync, and the scaler would
  // then issue steps against a baseline the renderer had already abandoned.
  const getState = useThree((state) => state.get);

  // The device pixel ratio is the natural ceiling; a 1x display has nothing
  // to scale up to. Read once per mount rather than per frame.
  const maxDpr = useMemo(() => {
    const device = typeof window !== 'undefined' ? window.devicePixelRatio : config.maxDpr;
    return Math.min(config.maxDpr, device || config.maxDpr);
  }, [config.maxDpr]);

  const resolvedConfig = useMemo<AdaptiveResolutionConfig>(
    () => ({ ...config, maxDpr }),
    [config, maxDpr],
  );

  const windowRef = useRef<FrameRateWindow | null>(null);
  const lastChangeAtRef = useRef(0);
  const settleFramesRef = useRef(0);

  if (windowRef.current === null) {
    windowRef.current = new FrameRateWindow(
      resolvedConfig.sampleSize,
      resolvedConfig.minSampleSize,
    );
  }

  // Re-seed the window when the shape of the decision changes so a stale
  // average from the previous configuration cannot drive the next step.
  useEffect(() => {
    windowRef.current?.reset();
    lastChangeAtRef.current = performance.now();
  }, [resolvedConfig]);

  // Disabling must leave the pixel ratio alone, not restore it - the user may
  // have moved it deliberately through the Canvas `dpr` prop.
  useEffect(() => {
    if (!enabled) windowRef.current?.reset();
  }, [enabled]);

  useFrame((_, delta) => {
    if (!enabled) return;

    const sampler = windowRef.current;
    if (!sampler) return;

    // After an idle stretch of the on-demand loop the first delta is the gap, not a slow frame.
    if (delta > IDLE_GAP_SECONDS) {
      sampler.reset();
      return;
    }

    if (settleFramesRef.current > 0) {
      settleFramesRef.current -= 1;
      return;
    }

    sampler.push(delta);

    // Always reason about the dpr the renderer is really using.
    const currentDpr = getState().viewport.dpr;
    const now = performance.now();
    const next = decideNextDpr(
      currentDpr,
      sampler.averageFps,
      now - lastChangeAtRef.current,
      resolvedConfig,
    );

    if (next !== currentDpr) {
      lastChangeAtRef.current = now;
      // Discard the samples that produced this decision; they describe the
      // old resolution and would immediately trigger another step.
      sampler.reset();
      settleFramesRef.current = SETTLE_FRAMES_AFTER_CHANGE;
      setDpr(next);
      onChange?.(next);
    }
  });

  return null;
}

/** Longest frame delta animations should integrate; larger gaps are idle time, not motion. */
export const MAX_ANIMATION_DELTA_SECONDS = 0.1;

/**
 * Frames can be seconds apart once the canvas renders on demand. Time-based
 * animations clamp the delta so they resume smoothly instead of jumping.
 */
export function clampFrameDelta(delta: number): number {
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  return Math.min(delta, MAX_ANIMATION_DELTA_SECONDS);
}

/** A frame delta above this means the loop was idle; it says nothing about frame rate. */
export const IDLE_GAP_SECONDS = 0.5;

export interface RenderDemandInputs {
  simRunning: boolean;
  autoRotate: boolean;
  /** Meteors and impact rings currently animating. */
  activeEffects: number;
  documentHidden: boolean;
}

/**
 * Whether something on screen changes without user input, so the canvas must
 * keep rendering every frame. When false the frameloop only runs when invalidated.
 */
export function needsContinuousRender(inputs: RenderDemandInputs): boolean {
  if (inputs.documentHidden) return false;
  return inputs.simRunning || inputs.autoRotate || inputs.activeEffects > 0;
}

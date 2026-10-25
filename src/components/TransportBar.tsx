import { useEffect, useRef, useState } from 'react';

import { useControlsStore } from '../store/useControlsStore';
import { useUIStore } from '../store/useUIStore';
import { copyText } from '../utils/clipboard';
import { encodeWorld } from '../utils/shareUrl';

/** Bounds of the Leva `tickMs` control; the speed slider uses the same range. */
export const TICK_MS_MIN = 10;
export const TICK_MS_MAX = 1500;

/**
 * Slider resolution. The slider position is 0..SLIDER_STEPS, slow (left) to fast (right).
 * Kept coarse enough that one arrow-key press changes speed by about 2%.
 */
export const SLIDER_STEPS = 250;

const MIN_TPS = 1000 / TICK_MS_MAX;
const MAX_TPS = 1000 / TICK_MS_MIN;

/** Speed ratio between adjacent slider positions (about 1.02). */
export const SPEED_RATIO_PER_STEP = (MAX_TPS / MIN_TPS) ** (1 / SLIDER_STEPS);

/**
 * Log-uniform mapping over ticks per second, so each slider step is an equal
 * ratio of speed and the 10–100 ticks/s range gets real slider travel.
 */
export function tickMsToSlider(tickMs: number): number {
  const tps = 1000 / Math.min(Math.max(tickMs, TICK_MS_MIN), TICK_MS_MAX);
  const fraction = Math.log(tps / MIN_TPS) / Math.log(MAX_TPS / MIN_TPS);
  return Math.round(fraction * SLIDER_STEPS);
}

export function sliderToTickMs(value: number): number {
  const fraction = Math.min(Math.max(value, 0), SLIDER_STEPS) / SLIDER_STEPS;
  const tps = MIN_TPS * (MAX_TPS / MIN_TPS) ** fraction;
  return Math.min(Math.max(Math.round(1000 / tps), TICK_MS_MIN), TICK_MS_MAX);
}

function ticksPerSecond(tickMs: number): string {
  return (1000 / Math.max(tickMs, TICK_MS_MIN)).toFixed(1);
}

/**
 * Basic sim controls that do not need the Leva panel. Buttons go through the
 * same command bus as the hotkeys; the speed slider writes `tickMs` via Leva.
 */
export function TransportBar() {
  const running = useUIStore((state) => state.simRunning);
  const tickMs = useUIStore((state) => state.simTickMs);
  const requestSimCommand = useUIStore((state) => state.requestSimCommand);
  const requestSimTickMs = useUIStore((state) => state.requestSimTickMs);

  const speed = ticksPerSecond(tickMs);

  const [shareMessage, setShareMessage] = useState('');
  const resetTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  // Writes the hash only on demand (no history spam), then copies the full URL.
  const share = async () => {
    const hash = encodeWorld(useControlsStore.getState(), useUIStore.getState().worldSeed);
    window.history.replaceState(null, '', `#${hash}`);
    const ok = await copyText(window.location.href);
    setShareMessage(ok ? 'Link copied' : 'Copy failed. The link is in the address bar.');
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setShareMessage(''), 2000);
  };
  const shareLabel = shareMessage === 'Link copied' ? 'Copied' : 'Copy link';

  return (
    <div className="transport-bar" role="group" aria-label="Simulation controls">
      <button
        type="button"
        className="transport-button transport-play"
        aria-label={running ? 'Pause simulation' : 'Play simulation'}
        aria-pressed={running}
        onClick={() => requestSimCommand('togglePlay')}
      >
        {running ? 'Pause' : 'Play'}
      </button>
      <button
        type="button"
        className="transport-button"
        aria-label="Step one generation"
        onClick={() => requestSimCommand('step')}
      >
        Step
      </button>
      <button
        type="button"
        className="transport-button"
        aria-label="Randomize grid"
        onClick={() => requestSimCommand('randomize')}
      >
        Randomize
      </button>
      <button
        type="button"
        className="transport-button"
        aria-label="Clear grid"
        onClick={() => requestSimCommand('clear')}
      >
        Clear
      </button>
      <button
        type="button"
        className="transport-button"
        aria-label="Copy link to this world"
        onClick={() => void share()}
      >
        {shareLabel}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {shareMessage}
      </span>
      <div className="transport-speed">
        <label htmlFor="transport-speed">Speed</label>
        <input
          id="transport-speed"
          type="range"
          min={0}
          max={SLIDER_STEPS}
          step={1}
          value={tickMsToSlider(tickMs)}
          aria-valuetext={`${speed} ticks per second`}
          onChange={(event) => requestSimTickMs(sliderToTickMs(Number(event.target.value)))}
        />
        <output htmlFor="transport-speed">{speed}/s</output>
      </div>
    </div>
  );
}

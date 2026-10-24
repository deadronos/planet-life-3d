import { useUIStore } from '../store/useUIStore';

/** Bounds of the Leva `tickMs` control; the speed slider uses the same range. */
export const TICK_MS_MIN = 10;
export const TICK_MS_MAX = 1500;

/** Slider resolution. The slider position is 0..SLIDER_STEPS, slow (left) to fast (right). */
export const SLIDER_STEPS = 10000;

const MIN_TPS = 1000 / TICK_MS_MAX;
const MAX_TPS = 1000 / TICK_MS_MIN;

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

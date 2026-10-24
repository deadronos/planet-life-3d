import { useUIStore } from '../store/useUIStore';

/** Bounds of the Leva `tickMs` control; the speed slider uses the same range. */
export const TICK_MS_MIN = 10;
export const TICK_MS_MAX = 1500;

/** The slider runs slow (left) to fast (right), while `tickMs` is a delay. */
export function tickMsToSlider(tickMs: number): number {
  return TICK_MS_MIN + TICK_MS_MAX - tickMs;
}

export function sliderToTickMs(value: number): number {
  return TICK_MS_MIN + TICK_MS_MAX - value;
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
        aria-label="Run simulation"
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
          min={TICK_MS_MIN}
          max={TICK_MS_MAX}
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

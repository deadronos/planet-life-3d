import { act, render, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Input = {
  value?: unknown;
  onChange?: (v: unknown, path: string, ctx: { initial: boolean }) => void;
  render?: (get: unknown) => boolean;
  transient?: boolean;
};
type Schema = Record<string, Record<string, Input>>;

let capturedSchema: Schema | null = null;
const levaValues = new Map<string, unknown>();
const setValueAtPath = vi.fn((path: string, value: unknown) => levaValues.set(path, value));

vi.mock('leva', () => ({
  useControls: (schema: () => Schema) => {
    capturedSchema = schema();
    return [{}, () => {}];
  },
  folder: (x: unknown) => x,
  button: (fn: () => void) => ({ __button: fn }),
  Leva: () => null,
  levaStore: {
    get: (path: string) => levaValues.get(path),
    setValueAtPath: (path: string, value: unknown) => setValueAtPath(path, value),
  },
}));

import LevaPanel from '../../src/components/LevaPanel';
import { usePlanetLifeControls } from '../../src/components/planetLife/controls';
import { COLOR_THEMES, RULE_PRESETS, WORLD_PRESETS } from '../../src/sim/presets';
import { createControlDefaults, useControlsStore } from '../../src/store/useControlsStore';
import { useUIStore } from '../../src/store/useUIStore';

const store = () => useControlsStore.getState();

beforeEach(() => {
  store().resetControls();
  capturedSchema = null;
  levaValues.clear();
  setValueAtPath.mockClear();
});

describe('controls store - defaults', () => {
  it('seeds the same defaults the Leva schema used', () => {
    const s = store();
    expect(s.running).toBe(true);
    expect(s.tickMs).toBe(120);
    expect(s.worldPreset).toBe('Custom');
    expect(s.theme).toBe('Default');
    expect(s.rulePreset).toBe('Conway');
    expect(s.birthDigits).toBe('3');
    expect(s.surviveDigits).toBe('23');
    expect(s.cellRenderMode).toBe('Texture');
    expect(s.seedPattern).toBe('Glider');
    expect(s.adaptiveResolution).toBe(true);
    expect(s.nightGlowIntensity).toBe(0.6);
    expect(s.nightGlowColor).toBe('#ffc46b');
  });

  function mockReducedMotion(matches: boolean) {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
  }
  afterEach(() => vi.unstubAllGlobals());

  it('uses a softer impact flash and no auto-rotate when reduced motion is requested', () => {
    mockReducedMotion(true);
    const d = createControlDefaults();
    expect(d.impactFlashIntensity).toBe(0.25);
    expect(d.autoRotate).toBe(false);
  });

  it('keeps the normal impact flash otherwise', () => {
    mockReducedMotion(false);
    const d = createControlDefaults();
    expect(d.impactFlashIntensity).toBe(0.75);
    expect(d.autoRotate).toBe(true);
  });
});

describe('controls store - preset side effects', () => {
  it('applies a rule preset', () => {
    const name = Object.keys(RULE_PRESETS).find((n) => n !== 'Conway')!;
    store().setControls({ rulePreset: name });
    expect(store().birthDigits).toBe(RULE_PRESETS[name].birth);
    expect(store().surviveDigits).toBe(RULE_PRESETS[name].survive);
  });

  it('leaves values alone for the Custom rule preset', () => {
    store().setControls({ birthDigits: '36' });
    store().setControls({ rulePreset: 'Custom' });
    expect(store().birthDigits).toBe('36');
  });

  it('applies theme colours', () => {
    const name = Object.keys(COLOR_THEMES).find((n) => n !== 'Default')!;
    store().setControls({ theme: name });
    expect(store().cellColor).toBe(COLOR_THEMES[name].cellColor);
    expect(store().impactRingColor).toBe(COLOR_THEMES[name].impactRingColor);
  });

  it('leaves colours alone for the Custom theme', () => {
    store().setControls({ cellColor: '#123456', theme: 'Custom' });
    expect(store().cellColor).toBe('#123456');
  });

  it('applies a world preset and its theme', () => {
    const name = Object.keys(WORLD_PRESETS)[0];
    const p = WORLD_PRESETS[name];
    store().setControls({ worldPreset: name });
    const s = store();
    expect(s.rulePreset).toBe('Custom');
    expect(s.birthDigits).toBe(p.birth);
    expect(s.gameMode).toBe(p.gameMode);
    expect(s.theme).toBe(p.theme);
    expect(s.seedPattern).toBe(p.seedPattern);
    expect(s.showerInterval).toBe(p.showerInterval);
    if (COLOR_THEMES[p.theme]) expect(s.cellColor).toBe(COLOR_THEMES[p.theme].cellColor);
  });

  it('forces Texture when GPU sim is on and Dots/Both is selected', () => {
    store().setControls({ gpuSim: true, cellRenderMode: 'Dots' });
    expect(store().cellRenderMode).toBe('Texture');
    store().setControls({ cellRenderMode: 'Both' });
    expect(store().cellRenderMode).toBe('Texture');
  });

  it('keeps Dots when GPU sim is off', () => {
    store().setControls({ gpuSim: false, cellRenderMode: 'Dots' });
    expect(store().cellRenderMode).toBe('Dots');
  });
});

describe('usePlanetLifeControls', () => {
  it('groups every control into domain slices', () => {
    store().setControls({
      tickMs: 333,
      planetRadius: 4,
      atmosphereHeight: 0.2,
      meteorSpeed: 7,
      impactRingSize: 1.5,
      seedPattern: 'Blinker',
      debugLogs: true,
    });
    const { result } = renderHook(() => usePlanetLifeControls());
    const c = result.current;
    expect(Object.keys(c).sort()).toEqual(
      ['sim', 'planet', 'atmosphere', 'cells', 'meteors', 'impacts', 'seeding', 'debug'].sort(),
    );
    expect(c.sim.tickMs).toBe(333);
    expect(c.planet.planetRadius).toBe(4);
    expect(c.atmosphere.atmosphereHeight).toBe(0.2);
    expect(c.meteors.meteorSpeed).toBe(7);
    expect(c.impacts.impactRingSize).toBe(1.5);
    expect(c.seeding.seedPattern).toBe('Blinker');
    expect(c.debug.debugLogs).toBe(true);
    expect(c.sim.worldPreset).toBe('Custom');
    expect(c.planet.theme).toBe('Default');
  });

  it('mirrors running/tickMs into the UI store', () => {
    renderHook(() => usePlanetLifeControls());
    act(() => store().setControls({ running: false, tickMs: 400 }));
    expect(useUIStore.getState().simRunning).toBe(false);
    expect(useUIStore.getState().simTickMs).toBe(400);
  });

  it('applies transport speed requests and the play/pause hotkey', () => {
    renderHook(() => usePlanetLifeControls());
    act(() => useUIStore.getState().requestSimTickMs(250));
    expect(store().tickMs).toBe(250);
    act(() => useUIStore.getState().requestSimCommand('togglePlay'));
    expect(store().running).toBe(false);
    act(() => useUIStore.getState().requestSimCommand('togglePlay'));
    expect(store().running).toBe(true);
  });
});

describe('LevaPanel', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('keeps the folder layout and seeds inputs from the store', () => {
    store().setControls({ tickMs: 222 });
    render(createElement(LevaPanel, { hidden: false }));
    const s = capturedSchema!;
    expect(Object.keys(s)).toEqual([
      'Camera',
      'Performance',
      'Rendering',
      'Basics',
      'Simulation',
      'Upgrades',
      'Meteors',
      'Seeding',
      'Debug',
      'Actions',
    ]);
    expect(Object.keys(s.Basics)).toEqual(['worldPreset', 'theme', 'cellRenderMode']);
    expect(s.Simulation.tickMs.value).toBe(222);
    expect(s.Basics.worldPreset.transient).toBe(false);
  });

  it('writes panel edits into the store, ignoring the initial onChange', () => {
    render(createElement(LevaPanel, { hidden: false }));
    const name = Object.keys(RULE_PRESETS).find((n) => n !== 'Conway')!;
    capturedSchema!.Simulation.tickMs.onChange?.(999, 'Simulation.tickMs', { initial: true });
    expect(store().tickMs).toBe(120);
    capturedSchema!.Simulation.rulePreset.onChange?.(name, 'Simulation.rulePreset', {
      initial: false,
    });
    expect(store().birthDigits).toBe(RULE_PRESETS[name].birth);
  });

  it('pushes store changes (presets, transport) into the panel', () => {
    render(createElement(LevaPanel, { hidden: false }));
    setValueAtPath.mockClear();
    const name = Object.keys(RULE_PRESETS).find((n) => n !== 'Conway')!;
    act(() => store().setControls({ rulePreset: name, running: false }));
    expect(setValueAtPath).toHaveBeenCalledWith('Simulation.running', false);
    expect(setValueAtPath).toHaveBeenCalledWith('Simulation.rulePreset', name);
    expect(setValueAtPath).toHaveBeenCalledWith('Simulation.birthDigits', RULE_PRESETS[name].birth);
  });

  it('dispatches Actions buttons through the sim command bus', () => {
    render(createElement(LevaPanel, { hidden: false }));
    const actions = capturedSchema!.Actions as unknown as Record<string, { __button: () => void }>;
    actions.Randomize.__button();
    expect(useUIStore.getState().simCommand?.command).toBe('randomize');
    actions.StepOnce.__button();
    expect(useUIStore.getState().simCommand?.command).toBe('step');
    actions.Clear.__button();
    expect(useUIStore.getState().simCommand?.command).toBe('clear');
  });

  it('hides debug controls outside dev builds and without ?debug', () => {
    vi.stubEnv('DEV', false);
    render(createElement(LevaPanel, { hidden: false }));
    expect(capturedSchema!.Debug.workerSim.render?.(() => undefined)).toBe(false);
    expect(capturedSchema!.Debug.gpuSim.render?.(() => undefined)).toBe(false);
  });

  it('shows debug controls in dev builds', () => {
    vi.stubEnv('DEV', true);
    render(createElement(LevaPanel, { hidden: false }));
    expect(capturedSchema!.Debug.workerSim.render?.(() => undefined)).toBe(true);
  });

  it('shows debug controls when the URL has ?debug', () => {
    vi.stubEnv('DEV', false);
    window.history.replaceState({}, '', '/?debug');
    try {
      render(createElement(LevaPanel, { hidden: false }));
      expect(capturedSchema!.Debug.workerSim.render?.(() => undefined)).toBe(true);
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });
});

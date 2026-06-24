// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSimWorker } from '../../src/components/planetLife/useSimWorker';
import type { EcologyProfileName } from '../../src/sim/ecology';
import type { Rules } from '../../src/sim/rules';

const GOL_RULES: Rules = {
  birth: [false, false, false, true, false, false, false, false, false],
  survive: [false, false, true, true, false, false, false, false, false],
};
const HIGHLIFE_RULES: Rules = {
  birth: [false, false, false, true, false, false, true, false, false],
  survive: [false, false, true, true, false, false, false, false, false],
};

type InMsg = { type: string; [k: string]: unknown };

class FakeWorker {
  static instances: FakeWorker[] = [];
  static reset() {
    FakeWorker.instances = [];
  }
  public onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public messages: InMsg[] = [];
  public terminated = false;
  public listeners: Record<string, EventListenerOrEventListenerObject[]> = {};
  // Re-exposed as an EventTarget-style API to match what the hook does.
  public addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }
  public removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
  }
  public postMessage(msg: unknown) {
    this.messages.push(msg as InMsg);
  }
  public terminate() {
    this.terminated = true;
  }
  constructor(_url: URL | string, _opts?: WorkerOptions) {
    FakeWorker.instances.push(this);
  }
}

beforeEach(() => {
  FakeWorker.reset();
  // @ts-expect-error test mock
  globalThis.Worker = FakeWorker;
});

function callHook(initial: {
  workerEnabled: boolean;
  rules?: Rules;
  gameMode?: 'Classic' | 'Colony';
  ecologyProfile?: EcologyProfileName;
  randomDensity?: number;
}) {
  return renderHook(
    (props) =>
      useSimWorker({
        workerEnabled: props.workerEnabled,
        safeLatCells: 10,
        safeLonCells: 16,
        rules: props.rules ?? GOL_RULES,
        ecologyProfile: props.ecologyProfile ?? 'None',
        randomDensity: props.randomDensity ?? 0.1,
        gameMode: props.gameMode ?? 'Classic',
        debugLogs: false,
        onSnapshot: () => {},
      }),
    {
      initialProps: {
        workerEnabled: initial.workerEnabled,
        rules: initial.rules ?? GOL_RULES,
        gameMode: initial.gameMode ?? ('Classic' as const),
        ecologyProfile: initial.ecologyProfile ?? 'None',
        randomDensity: initial.randomDensity ?? 0.1,
      },
    },
  );
}

describe('useSimWorker (regression: do not re-create worker on Leva changes)', () => {
  it('creates exactly one worker when workerEnabled is true', () => {
    callHook({ workerEnabled: true });
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it('does NOT re-create the worker when rules change', () => {
    const { rerender } = callHook({ workerEnabled: true });
    expect(FakeWorker.instances).toHaveLength(1);
    const w = FakeWorker.instances[0];
    // The first render may post a setRules right after the init; capture
    // the baseline so we can assert exactly one new setRules was posted.
    const baselineSetRulesCount = w.messages.filter((m) => m.type === 'setRules').length;

    rerender({
      workerEnabled: true,
      rules: HIGHLIFE_RULES,
      gameMode: 'Classic',
      ecologyProfile: 'None',
      randomDensity: 0.1,
    });

    expect(FakeWorker.instances).toHaveLength(1);
    const newSetRules = w.messages.filter((m) => m.type === 'setRules');
    expect(newSetRules).toHaveLength(baselineSetRulesCount + 1);
    const lastSetRules = newSetRules[newSetRules.length - 1] as unknown as { rules: Rules };
    expect(lastSetRules.rules).toEqual(HIGHLIFE_RULES);
  });

  it('does NOT re-create the worker when gameMode toggles', () => {
    const { rerender } = callHook({ workerEnabled: true });
    expect(FakeWorker.instances).toHaveLength(1);
    const w = FakeWorker.instances[0];
    const baselineSetGameModeCount = w.messages.filter((m) => m.type === 'setGameMode').length;

    rerender({
      workerEnabled: true,
      rules: GOL_RULES,
      gameMode: 'Colony',
      ecologyProfile: 'None',
      randomDensity: 0.1,
    });

    expect(FakeWorker.instances).toHaveLength(1);
    const newSetGameMode = w.messages.filter((m) => m.type === 'setGameMode');
    expect(newSetGameMode).toHaveLength(baselineSetGameModeCount + 1);
    const lastSetGameMode = newSetGameMode[newSetGameMode.length - 1] as unknown as {
      mode: 'Classic' | 'Colony';
    };
    expect(lastSetGameMode.mode).toBe('Colony');
  });

  it('does NOT re-create the worker when ecologyProfile changes', () => {
    const { rerender } = callHook({ workerEnabled: true });
    expect(FakeWorker.instances).toHaveLength(1);
    const w = FakeWorker.instances[0];
    const baselineSetEcologyCount = w.messages.filter((m) => m.type === 'setEcologyProfile').length;

    rerender({
      workerEnabled: true,
      rules: GOL_RULES,
      gameMode: 'Classic',
      ecologyProfile: 'Garden World',
      randomDensity: 0.1,
    });

    expect(FakeWorker.instances).toHaveLength(1);
    const newSetEcology = w.messages.filter((m) => m.type === 'setEcologyProfile');
    expect(newSetEcology).toHaveLength(baselineSetEcologyCount + 1);
    const lastSetEcology = newSetEcology[newSetEcology.length - 1] as unknown as {
      profile: EcologyProfileName;
    };
    expect(lastSetEcology.profile).toBe('Garden World');
  });

  it('does NOT re-create the worker when randomDensity slider moves (density applies on explicit Randomize)', () => {
    const { rerender } = callHook({ workerEnabled: true, randomDensity: 0.1 });
    expect(FakeWorker.instances).toHaveLength(1);
    const w = FakeWorker.instances[0];
    const baselineCount = w.messages.length;
    const baselineSetRules = w.messages.filter((m) => m.type === 'setRules').length;
    const baselineSetGameMode = w.messages.filter((m) => m.type === 'setGameMode').length;
    const baselineSetEcology = w.messages.filter((m) => m.type === 'setEcologyProfile').length;

    rerender({
      workerEnabled: true,
      rules: GOL_RULES,
      gameMode: 'Classic',
      ecologyProfile: 'None',
      randomDensity: 0.5,
    });

    expect(FakeWorker.instances).toHaveLength(1);
    // randomDensity change should NOT post any per-setting message.
    expect(w.messages.length).toBe(baselineCount);
    expect(w.messages.filter((m) => m.type === 'setRules')).toHaveLength(baselineSetRules);
    expect(w.messages.filter((m) => m.type === 'setGameMode')).toHaveLength(baselineSetGameMode);
    expect(w.messages.filter((m) => m.type === 'setEcologyProfile')).toHaveLength(
      baselineSetEcology,
    );
  });

  it('terminates the worker when workerEnabled flips to false', () => {
    const { rerender } = callHook({ workerEnabled: true });
    const w = FakeWorker.instances[0];
    expect(w.terminated).toBe(false);

    rerender({
      workerEnabled: false,
      rules: GOL_RULES,
      gameMode: 'Classic',
      ecologyProfile: 'None',
      randomDensity: 0.1,
    });

    expect(w.terminated).toBe(true);
  });
});

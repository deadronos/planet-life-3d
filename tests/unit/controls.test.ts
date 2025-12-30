import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

let setSpy: ReturnType<typeof vi.fn>;
let capturedSchema: unknown = null;

type SchemaShape = { Simulation?: { rulePreset?: { onChange?: (v: string) => void } } };

vi.mock('leva', () => ({
  useControls: (schemaOrName: unknown, schema?: unknown) => {
    const s = schema ?? schemaOrName;
    const obj: unknown = typeof s === 'function' ? (s as (...args: unknown[]) => unknown)() : s;
    capturedSchema = obj;

    const result: Record<string, unknown> = {};
    function isValueObject(v: unknown): v is { value: unknown } {
      return typeof v === 'object' && v !== null && 'value' in v;
    }
    function isPlainObject(v: unknown): v is Record<string, unknown> {
      return typeof v === 'object' && v !== null && !Array.isArray(v);
    }
    function flattenSchema(o: Record<string, unknown>) {
      for (const key of Object.keys(o)) {
        const val = o[key];
        if (isValueObject(val)) {
          result[key] = val.value;
          continue;
        }
        if (isPlainObject(val)) {
          flattenSchema(val);
          continue;
        }
        result[key] = val;
      }
    }

    if (typeof obj === 'object' && obj !== null) flattenSchema(obj as Record<string, unknown>);

    return [result, setSpy] as [Record<string, unknown>, typeof setSpy];
  },
  folder: (x: unknown) => x as Record<string, unknown>,
  button: () => () => {},
}));

// Import after mocking
import { usePlanetLifeControls } from '../../src/components/planetLife/controls';

describe('usePlanetLifeControls - onChange handlers', () => {
  beforeEach(() => {
    setSpy = vi.fn();
    capturedSchema = null;
  });

  it('calls set when rule preset onChange selected (non-Custom)', () => {
    const { result } = renderHook(() => usePlanetLifeControls());

    // The captured schema should include Simulation.rulePreset.onChange
    expect(capturedSchema).toBeTruthy();
    const rp = (capturedSchema as SchemaShape).Simulation?.rulePreset;
    expect(rp).toBeTruthy();
    expect(typeof rp!.onChange).toBe('function');

    // Now call onChange with 'Conway'
    rp!.onChange!('Conway');

    // setSpy should have been called with birthDigits and surviveDigits
    expect(setSpy).toHaveBeenCalled();
    const calledWith = setSpy.mock.calls[0][0];
    expect(calledWith.birthDigits).toBeDefined();
    expect(calledWith.surviveDigits).toBeDefined();
  });

  it('does not call set when rule preset set to Custom', () => {
    const { result } = renderHook(() => usePlanetLifeControls());

    const rp = (capturedSchema as SchemaShape).Simulation?.rulePreset;
    expect(rp).toBeTruthy();
    expect(typeof rp!.onChange).toBe('function');

    rp!.onChange!('Custom');

    expect(setSpy).not.toHaveBeenCalled();
  });
});

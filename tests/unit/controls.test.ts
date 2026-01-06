import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

let setSpy: ReturnType<typeof vi.fn>;
let capturedSchemas: unknown[] = [];

type SchemaShape = { Simulation?: { rulePreset?: { onChange?: (v: string) => void } } };

vi.mock('leva', () => ({
  useControls: (...args: unknown[]) => {
    let schema: unknown;

    // Detect arguments based on Leva signatures:
    // 1. useControls(schema)
    // 2. useControls(folderName, schema)
    // 3. useControls(schema, deps)
    // 4. useControls(folderName, schema, deps)

    if (typeof args[0] === 'string') {
        // Case 2 or 4
        schema = args[1];
    } else {
        // Case 1 or 3
        schema = args[0];
    }

    // Evaluate if function
    const obj: unknown = typeof schema === 'function' ? (schema as (...args: unknown[]) => unknown)() : schema;
    capturedSchemas.push(obj);

    const result: Record<string, unknown> = {};

    function extractValues(o: Record<string, unknown>) {
       if (!o) return;
       for (const key of Object.keys(o)) {
          const val = o[key];
          if (val && typeof val === 'object' && 'value' in val) {
              result[key] = (val as any).value;
          } else if (val && typeof val === 'object') {
              extractValues(val as Record<string, unknown>);
          } else {
              result[key] = val;
          }
       }
    }

    if (obj && typeof obj === 'object') extractValues(obj as Record<string, unknown>);

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
    capturedSchemas = [];
  });

  it('calls set when rule preset onChange selected (non-Custom)', () => {
    renderHook(() => usePlanetLifeControls());

    // console.log('Captured Schemas:', JSON.stringify(capturedSchemas, null, 2));

    const mainSchema = capturedSchemas.find(s => s && typeof s === 'object' && 'Simulation' in s);
    expect(mainSchema, 'Main schema with Simulation folder not found').toBeTruthy();

    const rp = (mainSchema as SchemaShape).Simulation?.rulePreset;
    expect(rp, 'rulePreset not found in schema').toBeTruthy();
    expect(typeof rp!.onChange).toBe('function');

    // Now call onChange with 'Conway'
    rp!.onChange!('Conway');

    expect(setSpy).toHaveBeenCalled();
    const calledWith = setSpy.mock.calls[0][0];
    expect(calledWith.birthDigits).toBeDefined();
    expect(calledWith.surviveDigits).toBeDefined();
  });

  it('does not call set when rule preset set to Custom', () => {
    renderHook(() => usePlanetLifeControls());

    const mainSchema = capturedSchemas.find(s => s && typeof s === 'object' && 'Simulation' in s);
    expect(mainSchema).toBeTruthy();

    const rp = (mainSchema as SchemaShape).Simulation?.rulePreset;
    expect(rp).toBeTruthy();
    expect(typeof rp!.onChange).toBe('function');

    rp!.onChange!('Custom');

    expect(setSpy).not.toHaveBeenCalled();
  });
});

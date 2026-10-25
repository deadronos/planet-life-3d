/** Leva stand-in that returns each control's default value; shared by integration tests. */
export const levaMock = {
  useControls: (schemaOrName: unknown, schema?: unknown) => {
    let s = schema ?? schemaOrName;
    // Leva's `folder()` takes a plain object and returns a wrapper, so the
    // schema has to be unwrapped before the value objects below are read.
    const isFunction = typeof s === 'function';
    if (isFunction) {
      s = (s as () => unknown)();
    }

    const result: Record<string, unknown> = {};
    function isValueObject(v: unknown): v is { value: unknown } {
      return typeof v === 'object' && v !== null && 'value' in v;
    }

    const isPlainObject = (v: unknown): v is Record<string, unknown> => {
      return typeof v === 'object' && v !== null && !Array.isArray(v);
    };

    const flattenSchema = (obj: Record<string, unknown>) => {
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (isValueObject(val)) {
          result[key] = val.value;
          continue;
        }
        if (isPlainObject(val)) {
          // `folder()` returns a nested schema object; flatten it into the top-level result.
          // This matches how the component destructures the control values.
          flattenSchema(val);
          continue;
        }
        result[key] = val;
      }
    };

    if (typeof s === 'object' && s !== null) {
      flattenSchema(s as Record<string, unknown>);
    }

    if (isFunction) {
      return [result, () => {}];
    }
    return result;
  },
  folder: (obj: unknown) => obj,
  button: () => () => {},
};

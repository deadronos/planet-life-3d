/**
 * Helpers for writing instance transforms without going through Object3D.
 *
 * Cells are drawn as pure translations: `cellRadius` is baked into the
 * instance geometry, the per-instance scale is always 1, and rotation is
 * never touched. Composing a full 4x4 matrix per cell per tick just to
 * recover that identity-with-translation is wasted work on the main thread.
 */

/** Floats per 4x4 matrix in a three.js instanced buffer. */
export const MATRIX_STRIDE = 16;

/**
 * Write an identity matrix carrying a translation into a raw instance buffer.
 *
 * Column-major, matching three.js: indices 12/13/14 hold the translation and
 * the rest stay at identity, so a cell occupies exactly the same footprint as
 * one produced by `Object3D.updateMatrix()` with identity rotation/scale.
 *
 * @param array The `instanceMatrix.array` backing store.
 * @param index Instance slot.
 * @param x,y,z World-space translation for this instance.
 */
export function writeTranslationMatrix(
  array: Float32Array,
  index: number,
  x: number,
  y: number,
  z: number,
): void {
  const base = index * MATRIX_STRIDE;
  array[base] = 1;
  array[base + 1] = 0;
  array[base + 2] = 0;
  array[base + 3] = 0;

  array[base + 4] = 0;
  array[base + 5] = 1;
  array[base + 6] = 0;
  array[base + 7] = 0;

  array[base + 8] = 0;
  array[base + 9] = 0;
  array[base + 10] = 1;
  array[base + 11] = 0;

  array[base + 12] = x;
  array[base + 13] = y;
  array[base + 14] = z;
  array[base + 15] = 1;
}

/** Read a translation back out of a raw instance buffer. Test helper. */
export function readTranslation(
  array: Float32Array,
  index: number,
): { x: number; y: number; z: number } {
  const base = index * MATRIX_STRIDE;
  return { x: array[base + 12], y: array[base + 13], z: array[base + 14] };
}

/** True when the slot holds an identity rotation/scale basis. */
export function isIdentityBasis(array: Float32Array, index: number): boolean {
  const b = index * MATRIX_STRIDE;
  return (
    array[b] === 1 &&
    array[b + 5] === 1 &&
    array[b + 10] === 1 &&
    array[b + 15] === 1 &&
    array[b + 1] === 0 &&
    array[b + 2] === 0 &&
    array[b + 3] === 0 &&
    array[b + 4] === 0 &&
    array[b + 6] === 0 &&
    array[b + 7] === 0 &&
    array[b + 8] === 0 &&
    array[b + 9] === 0 &&
    array[b + 11] === 0
  );
}

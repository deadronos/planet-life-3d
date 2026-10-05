import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
  isIdentityBasis,
  MATRIX_STRIDE,
  readTranslation,
  writeTranslationMatrix,
} from '../../src/components/planetLife/instanceMatrix';

describe('writeTranslationMatrix', () => {
  it('matches Object3D.updateMatrix for identity rotation and unit scale', () => {
    // The whole point of the optimisation is that it is indistinguishable from
    // the Object3D path it replaces, so assert against a real three.js compose.
    for (const [x, y, z] of [
      [0, 0, 0],
      [1.5, -2.25, 3.125],
      [-2.6, 0, 0.04],
    ] as const) {
      const dummy = new THREE.Object3D();
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();

      const arr = new Float32Array(MATRIX_STRIDE);
      writeTranslationMatrix(arr, 0, x, y, z);

      const expected = dummy.matrix.toArray();
      for (let i = 0; i < MATRIX_STRIDE; i++) {
        expect(arr[i]).toBeCloseTo(expected[i], 6);
      }
    }
  });

  it('stores the translation in the column-major 12/13/14 slots', () => {
    const arr = new Float32Array(MATRIX_STRIDE);
    writeTranslationMatrix(arr, 0, 1, 2, 3);
    expect(arr[12]).toBe(1);
    expect(arr[13]).toBe(2);
    expect(arr[14]).toBe(3);
    expect(readTranslation(arr, 0)).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('leaves rotation and scale at identity', () => {
    const arr = new Float32Array(MATRIX_STRIDE).fill(99);
    writeTranslationMatrix(arr, 0, 4, 5, 6);
    expect(isIdentityBasis(arr, 0)).toBe(true);
  });

  it('writes each slot independently', () => {
    const arr = new Float32Array(4 * MATRIX_STRIDE);
    writeTranslationMatrix(arr, 0, 1, 2, 3);
    writeTranslationMatrix(arr, 1, 4, 5, 6);
    writeTranslationMatrix(arr, 2, 7, 8, 9);
    writeTranslationMatrix(arr, 3, -1, -2, -3);

    expect(readTranslation(arr, 0)).toEqual({ x: 1, y: 2, z: 3 });
    expect(readTranslation(arr, 1)).toEqual({ x: 4, y: 5, z: 6 });
    expect(readTranslation(arr, 2)).toEqual({ x: 7, y: 8, z: 9 });
    expect(readTranslation(arr, 3)).toEqual({ x: -1, y: -2, z: -3 });
  });

  it('does not disturb neighbouring slots when overwriting', () => {
    const arr = new Float32Array(3 * MATRIX_STRIDE);
    writeTranslationMatrix(arr, 0, 1, 1, 1);
    writeTranslationMatrix(arr, 2, 9, 9, 9);
    // Rewriting slot 1 must not corrupt slot 0 or 2.
    writeTranslationMatrix(arr, 1, 5, 5, 5);
    expect(readTranslation(arr, 0)).toEqual({ x: 1, y: 1, z: 1 });
    expect(readTranslation(arr, 1)).toEqual({ x: 5, y: 5, z: 5 });
    expect(readTranslation(arr, 2)).toEqual({ x: 9, y: 9, z: 9 });
  });

  it('handles the zero position', () => {
    const arr = new Float32Array(MATRIX_STRIDE);
    writeTranslationMatrix(arr, 0, 0, 0, 0);
    expect(readTranslation(arr, 0)).toEqual({ x: 0, y: 0, z: 0 });
    expect(isIdentityBasis(arr, 0)).toBe(true);
  });
});

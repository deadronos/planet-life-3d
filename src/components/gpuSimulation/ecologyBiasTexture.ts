import * as THREE from 'three';

import { buildEcologyTables, ECOLOGY_PROFILES, type EcologyProfileName } from '../../sim/ecology';
import type { Resolution } from './common';

/**
 * Encode a per-cell ecology neighbor bias (`-1 | 0 | 1`) into an 8-bit unsigned
 * channel value with wide quantization margins (`0`, `128`, `255`).
 */
export function encodeEcologyBiasByte(bias: number): number {
  if (bias > 0) return 255;
  if (bias < 0) return 0;
  return 128;
}

/**
 * Bake the per-cell ecology neighbor-count bias into a static `THREE.DataTexture`
 * aligned 1:1 with CPU `computeEcologySample` (`x = lon`, `y = lat`, `flipY = false`,
 * `NearestFilter`). Returns a 1x1 neutral texture when `ecologyProfile === 'None'`.
 */
export function createEcologyBiasTexture(
  resolution: Resolution,
  ecologyProfile: EcologyProfileName,
): THREE.DataTexture {
  const resolved = ECOLOGY_PROFILES[ecologyProfile]?.name ?? 'None';

  let width = 1;
  let height = 1;
  let data: Uint8Array;

  if (resolved === 'None') {
    data = new Uint8Array([128, 128, 0, 255]);
  } else {
    width = Math.max(1, Math.floor(resolution.width));
    height = Math.max(1, Math.floor(resolution.height));
    const { bias: biasTable, affinity: affinityTable } = buildEcologyTables(
      height,
      width,
      resolved,
    );
    const cellCount = biasTable.length;
    data = new Uint8Array(cellCount * 4);
    for (let i = 0; i < cellCount; i++) {
      const di = i * 4;
      data[di] = encodeEcologyBiasByte(biasTable[i]);
      data[di + 1] = encodeEcologyBiasByte(affinityTable[i]);
      data[di + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

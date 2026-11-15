// @vitest-environment jsdom
import { create } from '@react-three/test-renderer';
import { createRef } from 'react';
import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
  CellsInstancedMesh,
  patchInstancedEmissiveShader,
} from '../../src/components/planetLife/CellsInstancedMesh';

describe('CellsInstancedMesh', () => {
  it('uses white base and emissive colors without vertexColors so instanceColor is not double-tinted', async () => {
    const cellsRef = createRef<THREE.InstancedMesh>();
    const renderer = await create(
      <CellsInstancedMesh cellsRef={cellsRef} maxInstances={16} cellRadius={0.05} />,
    );

    const mesh = cellsRef.current!;
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(material.color.getHexString()).toBe('ffffff');
    expect(material.emissive.getHexString()).toBe('ffffff');
    expect(material.vertexColors).toBe(false);
    expect(material.emissiveIntensity).toBeCloseTo(0.7);

    await renderer.unmount();
  });

  it('patches fragment shader so totalEmissiveRadiance is modulated by per-instance vColor', () => {
    const shader = {
      fragmentShader: 'void main() {\n  vec3 totalEmissiveRadiance = emissive;\n}',
    };
    patchInstancedEmissiveShader(shader);
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance *= vColor.rgb;');
    expect(shader.fragmentShader).toContain(
      '#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )',
    );
  });
});

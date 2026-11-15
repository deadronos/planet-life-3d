// @vitest-environment jsdom
import { render } from '@testing-library/react';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { createGpuOverlayMaterial, LifeOverlay } from '../../src/components/planetLife/LifeOverlay';

function makeMaterial() {
  return createGpuOverlayMaterial({
    cellColor: '#00ffaa',
    cellColorMode: 'Solid',
    colonyColorA: '#00ffaa',
    colonyColorB: '#ff5500',
    heatLowColor: '#0000ff',
    heatMidColor: '#00ff00',
    heatHighColor: '#ff0000',
    ageFadeHalfLife: 20,
    cellOverlayOpacity: 1,
    gameMode: 'Classic',
    nightGlowIntensity: 0.5,
    nightGlowColor: '#001122',
    lightPosition: [10, 10, 10],
  });
}

function spyOnNeedsUpdate(texture: THREE.Texture) {
  const calls: boolean[] = [];
  const descriptor = Object.getOwnPropertyDescriptor(THREE.Texture.prototype, 'needsUpdate');
  Object.defineProperty(texture, 'needsUpdate', {
    configurable: true,
    set(value: boolean) {
      calls.push(value);
      descriptor?.set?.call(this, value);
    },
  });
  return calls;
}

describe('LifeOverlay', () => {
  it('assigns uLifeTexture.value without mutating needsUpdate on render-target textures', () => {
    const material = makeMaterial();
    const rtA = new THREE.WebGLRenderTarget(16, 8);
    const rtB = new THREE.WebGLRenderTarget(16, 8);
    const versionABefore = rtA.texture.version;
    const versionBBefore = rtB.texture.version;
    const needsUpdateCallsA = spyOnNeedsUpdate(rtA.texture);
    const needsUpdateCallsB = spyOnNeedsUpdate(rtB.texture);

    const baseProps = {
      planetRadius: 2.5,
      cellLift: 0.02,
      pulseSpeed: 1,
      pulseIntensity: 0.2,
      cellOverlayOpacity: 0.9,
      gpuOverlayMaterial: material,
    };

    const { rerender } = render(<LifeOverlay {...baseProps} lifeTexture={rtA.texture} />);

    expect(material.uniforms.uLifeTexture.value).toBe(rtA.texture);
    expect(needsUpdateCallsA).toEqual([]);
    expect(rtA.texture.version).toBe(versionABefore);
    expect(material.uniforms.uDebugMode.value).toBe(0);
    expect(material.uniforms.uDebugScale.value).toBe(1.0);

    // Simulate a GPU ping-pong buffer swap and explicit channel-debug toggle.
    rerender(<LifeOverlay {...baseProps} lifeTexture={rtB.texture} debugChannelView={true} />);

    expect(material.uniforms.uLifeTexture.value).toBe(rtB.texture);
    expect(needsUpdateCallsB).toEqual([]);
    expect(rtB.texture.version).toBe(versionBBefore);
    expect(material.uniforms.uDebugOverlay.value).toBe(false);
    expect(material.uniforms.uDebugMode.value).toBe(4);
    expect(material.uniforms.uDebugScale.value).toBe(4.0);

    rtA.dispose();
    rtB.dispose();
    material.dispose();
  });

  it('handles null lifeTexture without throwing', () => {
    const material = makeMaterial();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <LifeOverlay
        planetRadius={2.5}
        cellLift={0.02}
        pulseSpeed={1}
        pulseIntensity={0.2}
        cellOverlayOpacity={0.9}
        lifeTexture={null}
        gpuOverlayMaterial={material}
      />,
    );

    expect(material.uniforms.uLifeTexture.value).toBeNull();
    expect(material.uniforms.uDebugMode.value).toBe(0);
    expect(material.uniforms.uDebugScale.value).toBe(1.0);

    consoleSpy.mockRestore();
    material.dispose();
  });

  it('enables depthTest while keeping depthWrite disabled so meteors occlude cells', () => {
    const material = makeMaterial();
    expect(material.depthTest).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.transparent).toBe(true);
    material.dispose();
  });
});

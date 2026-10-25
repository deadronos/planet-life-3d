import { describe, expect, it } from 'vitest';

import { gpuOverlayFragmentShader } from '../../src/shaders/gpuOverlay.frag';

describe('gpuOverlayFragmentShader', () => {
  it('defines and applies uCellOverlayOpacity to output alpha', () => {
    expect(gpuOverlayFragmentShader).toContain('uniform float uCellOverlayOpacity;');
    expect(gpuOverlayFragmentShader).toContain(
      'gl_FragColor = vec4(finalColor + glow, alpha * uCellOverlayOpacity);',
    );
  });

  it('adds a darkness-gated night glow term', () => {
    expect(gpuOverlayFragmentShader).toContain('uniform float uNightGlowIntensity;');
    expect(gpuOverlayFragmentShader).toContain('-dot(normalize(vWorldNormal), uLightDir)');
  });
});

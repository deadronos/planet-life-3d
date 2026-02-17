import { describe, expect, it } from 'vitest';

import { gpuOverlayFragmentShader } from '../../src/shaders/gpuOverlay.frag';

describe('gpuOverlayFragmentShader', () => {
  it('defines and applies uCellOverlayOpacity to output alpha', () => {
    expect(gpuOverlayFragmentShader).toContain('uniform float uCellOverlayOpacity;');
    expect(gpuOverlayFragmentShader).toContain(
      'gl_FragColor = vec4(finalColor, alpha * uCellOverlayOpacity);',
    );
  });
});

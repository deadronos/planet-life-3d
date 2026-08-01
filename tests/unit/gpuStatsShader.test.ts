import { describe, expect, it } from 'vitest';

import { gpuStatsFragmentShader } from '../../src/shaders/gpuStats.frag';

describe('GPU stats readback shader', () => {
  it('classifies births (dead -> alive) into the R channel', () => {
    expect(gpuStatsFragmentShader).toContain('uniform sampler2D uPrevState');
    expect(gpuStatsFragmentShader).toContain('uniform sampler2D uCurrentState');
    expect(gpuStatsFragmentShader).toContain(
      'float birth = (prev < 0.1 && cur > 0.1) ? 1.0 : 0.0;',
    );
  });

  it('classifies deaths (alive -> dead) into the G channel', () => {
    expect(gpuStatsFragmentShader).toContain(
      'float death = (prev > 0.1 && cur < 0.1) ? 1.0 : 0.0;',
    );
  });

  it('classifies the alive population into the B channel', () => {
    expect(gpuStatsFragmentShader).toContain('float alive = (cur > 0.1) ? 1.0 : 0.0;');
    expect(gpuStatsFragmentShader).toContain('gl_FragColor = vec4(birth, death, alive, 1.0)');
  });
});

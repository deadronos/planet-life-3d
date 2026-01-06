import { describe, expect, it } from 'vitest';

import { simulationFragmentShader } from '../../src/shaders/simulation.frag';
import { simulationVertexShader } from '../../src/shaders/simulation.vert';

describe('GPU Simulation Shaders', () => {
  it('should export vertex shader with UV passthrough', () => {
    expect(simulationVertexShader).toBeDefined();
    expect(simulationVertexShader).toContain('varying vec2 vUv');
    expect(simulationVertexShader).toContain('vUv = uv');
    expect(simulationVertexShader).toContain('gl_Position');
  });

  it('should export fragment shader with customizable rules logic', () => {
    expect(simulationFragmentShader).toBeDefined();
    expect(simulationFragmentShader).toContain('uniform sampler2D uTexture');
    expect(simulationFragmentShader).toContain('uniform vec2 uResolution');
    expect(simulationFragmentShader).toContain('varying vec2 vUv');
  });

  it('should support customizable birth and survive rules via uniforms', () => {
    // Check for uniform arrays for birth and survive rules
    expect(simulationFragmentShader).toContain('uniform float uBirthRules[9]');
    expect(simulationFragmentShader).toContain('uniform float uSurviveRules[9]');
  });

  it('should implement neighbor sampling with sphere wrapping', () => {
    expect(simulationFragmentShader).toContain('sampleNeighbor');
    // Longitude wrapping (fract for U coordinate)
    expect(simulationFragmentShader).toContain('fract');
    // Latitude bounds check (out-of-range rows should be empty)
    expect(simulationFragmentShader).toContain('neighborUV.y < 0.0');
    expect(simulationFragmentShader).toContain('neighborUV.y > 1.0');
  });

  it('should count 8 neighbors in fragment shader', () => {
    // Check that we sample all 8 neighbors around the current cell
    const neighborSamples = simulationFragmentShader.match(/sampleNeighbor/g);
    expect(neighborSamples).toBeDefined();
    // 8 neighbors + function definition = 9 occurrences
    expect(neighborSamples!.length).toBeGreaterThanOrEqual(8);
  });

  it('should implement customizable birth and survival rules', () => {
    expect(simulationFragmentShader).toContain('nextState');
    // Check for alive/dead state transitions
    expect(simulationFragmentShader).toContain('current > 0.5');
    // Check for neighbor-based rules using uniform arrays
    expect(simulationFragmentShader).toContain('neighborCount');
    expect(simulationFragmentShader).toContain('uBirthRules[neighborCount]');
    expect(simulationFragmentShader).toContain('uSurviveRules[neighborCount]');
  });

  it('should output to gl_FragColor', () => {
    expect(simulationFragmentShader).toContain('gl_FragColor');
    expect(simulationFragmentShader).toContain('vec4');
  });
});

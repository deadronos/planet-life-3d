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

  it('should export fragment shader with Game of Life logic', () => {
    expect(simulationFragmentShader).toBeDefined();
    expect(simulationFragmentShader).toContain('uniform sampler2D uTexture');
    expect(simulationFragmentShader).toContain('uniform vec2 uResolution');
    expect(simulationFragmentShader).toContain('varying vec2 vUv');
  });

  it('should implement neighbor sampling with sphere wrapping', () => {
    expect(simulationFragmentShader).toContain('sampleNeighbor');
    // Longitude wrapping (fract for U coordinate)
    expect(simulationFragmentShader).toContain('fract');
    // Latitude clamping (clamp for V coordinate)
    expect(simulationFragmentShader).toContain('clamp');
  });

  it('should count 8 neighbors in fragment shader', () => {
    // Check that we sample all 8 neighbors around the current cell
    const neighborSamples = simulationFragmentShader.match(/sampleNeighbor/g);
    expect(neighborSamples).toBeDefined();
    // 8 neighbors + function definition = 9 occurrences
    expect(neighborSamples!.length).toBeGreaterThanOrEqual(8);
  });

  it('should implement Game of Life birth and survival rules', () => {
    expect(simulationFragmentShader).toContain('nextState');
    // Check for alive/dead state transitions
    expect(simulationFragmentShader).toContain('current > 0.5');
    // Check for neighbor-based rules
    expect(simulationFragmentShader).toContain('neighbors');
  });

  it('should output to gl_FragColor', () => {
    expect(simulationFragmentShader).toContain('gl_FragColor');
    expect(simulationFragmentShader).toContain('vec4');
  });
});

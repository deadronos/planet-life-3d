import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
  computeMeteorState,
  DEFAULT_METEOR_STYLE,
  getMeteorVisualStyle,
  TOOL_METEOR_STYLES,
} from '../../src/components/meteorTypes';

describe('computeMeteorState', () => {
  it('clones origin and normalizes direction', () => {
    const origin = new THREE.Vector3(2, 0, 0);
    const direction = new THREE.Vector3(1, 1, 0);

    const s = computeMeteorState(origin, direction);

    // origin is cloned
    expect(s.pos).not.toBe(origin);
    expect(s.pos.x).toBeCloseTo(origin.x);

    // direction is normalized
    const len = Math.sqrt(1 * 1 + 1 * 1);
    expect(s.dir.x).toBeCloseTo(1 / len);
    expect(s.dir.y).toBeCloseTo(1 / len);
    expect(s.dir.z).toBeCloseTo(0);
  });

  it('normalizes an already unit direction without changing it', () => {
    const origin = new THREE.Vector3(0, 0, 0);
    const direction = new THREE.Vector3(0, 1, 0);
    const s = computeMeteorState(origin, direction);

    expect(s.dir.x).toBeCloseTo(0);
    expect(s.dir.y).toBeCloseTo(1);
    expect(s.dir.z).toBeCloseTo(0);
  });
});

describe('getMeteorVisualStyle', () => {
  it('returns distinct styles for Life, Sterilizer, Mutation, and Comet', () => {
    const tools = ['Life', 'Sterilizer', 'Mutation', 'Comet'] as const;
    const styles = tools.map((tool) => getMeteorVisualStyle('user', tool));

    expect(new Set(styles.map((s) => s.coreColor)).size).toBe(4);
    expect(new Set(styles.map((s) => s.emissiveColor)).size).toBe(4);
    expect(new Set(styles.map((s) => s.trailColor)).size).toBe(4);
    expect(new Set(styles.map((s) => s.impactRingColor)).size).toBe(4);
    expect(TOOL_METEOR_STYLES.Sterilizer.flashMultiplier).toBeGreaterThan(
      TOOL_METEOR_STYLES.Life.flashMultiplier,
    );
  });

  it('keeps shower meteors clean and honors default/theme impactRingColor', () => {
    const style = getMeteorVisualStyle('shower', 'Sterilizer', '#ff88cc');
    expect(style.coreColor).toBe(DEFAULT_METEOR_STYLE.coreColor);
    expect(style.emissiveColor).toBe(DEFAULT_METEOR_STYLE.emissiveColor);
    expect(style.trailColor).toBe(DEFAULT_METEOR_STYLE.trailColor);
    expect(style.impactRingColor).toBe('#ff88cc');
  });

  it('falls back to default style when tool is omitted or Probe', () => {
    expect(getMeteorVisualStyle('user', undefined, '#123456')).toEqual({
      ...DEFAULT_METEOR_STYLE,
      impactRingColor: '#123456',
    });
    expect(getMeteorVisualStyle('user', 'Probe')).toEqual(DEFAULT_METEOR_STYLE);
  });
});

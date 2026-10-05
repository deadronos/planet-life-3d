import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { type LifeTexture, writeLifeTexture } from '../../src/components/planetLife/lifeTexture';

function makeLifeTex(w = 4, h = 3): LifeTexture {
  const data = new Uint8Array(w * h * 4);
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  return { data, tex, w, h };
}

/** The expression the heat lookup table replaced. */
function originalHeatByte(h: number): number {
  return Math.min(255, Math.floor((h / 8.0) * 255));
}

describe('writeLifeTexture heat channel', () => {
  it('matches the original expression for every possible byte value', () => {
    // The lookup table is an optimisation of this formula; if the two ever
    // drift the colour ramps would silently change.
    for (let heat = 0; heat < 256; heat++) {
      const lifeTex = makeLifeTex(1, 1);
      const grid = new Uint8Array([1]);
      const ages = new Uint8Array([0]);
      const heatArr = new Uint8Array([heat]);

      writeLifeTexture({
        grid,
        ages,
        heat: heatArr,
        lifeTex,
        gameMode: 'Classic',
        debugLogs: false,
      });

      expect(lifeTex.data[2]).toBe(originalHeatByte(heat));
    }
  });

  it('maps the normal 0-8 neighbour range as documented', () => {
    const expected = [0, 31, 63, 95, 127, 159, 191, 223, 255];
    for (let heat = 0; heat <= 8; heat++) {
      const lifeTex = makeLifeTex(1, 1);
      writeLifeTexture({
        grid: new Uint8Array([1]),
        ages: new Uint8Array([0]),
        heat: new Uint8Array([heat]),
        lifeTex,
        gameMode: 'Classic',
        debugLogs: false,
      });
      expect(lifeTex.data[2]).toBe(expected[heat]);
    }
  });

  it('clamps out-of-range heat rather than overflowing the byte', () => {
    const lifeTex = makeLifeTex(1, 1);
    writeLifeTexture({
      grid: new Uint8Array([1]),
      ages: new Uint8Array([0]),
      heat: new Uint8Array([255]),
      lifeTex,
      gameMode: 'Classic',
      debugLogs: false,
    });
    expect(lifeTex.data[2]).toBe(255);
  });
});

describe('writeLifeTexture state channel', () => {
  it('writes Classic alive/dead as 255/0', () => {
    const lifeTex = makeLifeTex(2, 1);
    writeLifeTexture({
      grid: new Uint8Array([1, 0]),
      ages: new Uint8Array([0, 0]),
      heat: new Uint8Array([0, 0]),
      lifeTex,
      gameMode: 'Classic',
      debugLogs: false,
    });
    expect(lifeTex.data[0]).toBe(255);
    expect(lifeTex.data[4]).toBe(0);
  });

  it('writes Colony states as 0/84/171', () => {
    const lifeTex = makeLifeTex(3, 1);
    writeLifeTexture({
      grid: new Uint8Array([0, 1, 2]),
      ages: new Uint8Array([0, 0, 0]),
      heat: new Uint8Array([0, 0, 0]),
      lifeTex,
      gameMode: 'Colony',
      debugLogs: false,
    });
    expect(lifeTex.data[0]).toBe(0);
    expect(lifeTex.data[4]).toBe(84);
    expect(lifeTex.data[8]).toBe(171);
  });

  it('always marks the alpha channel opaque', () => {
    const lifeTex = makeLifeTex(2, 1);
    writeLifeTexture({
      grid: new Uint8Array([1, 0]),
      ages: new Uint8Array([0, 0]),
      heat: new Uint8Array([0, 0]),
      lifeTex,
      gameMode: 'Classic',
      debugLogs: false,
    });
    for (let i = 0; i < 2; i++) expect(lifeTex.data[i * 4 + 3]).toBe(255);
  });

  it('passes the age channel through untouched', () => {
    const lifeTex = makeLifeTex(2, 1);
    writeLifeTexture({
      grid: new Uint8Array([1, 1]),
      ages: new Uint8Array([7, 200]),
      heat: new Uint8Array([0, 0]),
      lifeTex,
      gameMode: 'Classic',
      debugLogs: false,
    });
    expect(lifeTex.data[1]).toBe(7);
    expect(lifeTex.data[5]).toBe(200);
  });

  it('flags the texture for upload', () => {
    // `needsUpdate` is a write-only setter in three.js, so assert on the
    // version counter it bumps rather than trying to read the flag back.
    const lifeTex = makeLifeTex(1, 1);
    const before = lifeTex.tex.version;
    writeLifeTexture({
      grid: new Uint8Array([1]),
      ages: new Uint8Array([0]),
      heat: new Uint8Array([0]),
      lifeTex,
      gameMode: 'Classic',
      debugLogs: false,
    });
    expect(lifeTex.tex.version).toBeGreaterThan(before);
  });
});

describe('writeLifeTexture alive count', () => {
  it('still reports the population when debug logging is off', () => {
    const lifeTex = makeLifeTex(4, 2);
    const count = writeLifeTexture({
      grid: new Uint8Array([1, 0, 1, 1, 0, 0, 1, 0]),
      ages: new Uint8Array(8),
      heat: new Uint8Array(8),
      lifeTex,
      gameMode: 'Classic',
      debugLogs: false,
    });
    expect(count).toBe(4);
  });

  it('counts zero for an empty board', () => {
    const lifeTex = makeLifeTex(2, 2);
    const count = writeLifeTexture({
      grid: new Uint8Array(4),
      ages: new Uint8Array(4),
      heat: new Uint8Array(4),
      lifeTex,
      gameMode: 'Classic',
      debugLogs: false,
    });
    expect(count).toBe(0);
  });

  it('does not log when debug logging is disabled', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const lifeTex = makeLifeTex(2, 1);
    writeLifeTexture({
      grid: new Uint8Array([1, 1]),
      ages: new Uint8Array([0, 0]),
      heat: new Uint8Array([0, 0]),
      lifeTex,
      gameMode: 'Classic',
      debugLogs: false,
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

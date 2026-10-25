import { beforeEach, describe, expect, it } from 'vitest';

import { useUIStore } from '../../src/store/useUIStore';
import {
  appendSample,
  describePopulationTrend,
  POPULATION_HISTORY_LENGTH,
  sparklinePoints,
} from '../../src/utils/populationHistory';

const stat = (generation: number, population: number) => ({
  generation,
  population,
  birthsLastTick: 0,
  deathsLastTick: 0,
});

describe('populationHistory', () => {
  beforeEach(() => {
    useUIStore.setState({ stats: stat(0, 0), populationHistory: [] });
  });

  it('caps the ring buffer, dropping the oldest', () => {
    let h: number[] = [];
    for (let i = 0; i < POPULATION_HISTORY_LENGTH + 5; i++) h = appendSample(h, i);
    expect(h).toHaveLength(POPULATION_HISTORY_LENGTH);
    expect(h[0]).toBe(5);
    expect(h[h.length - 1]).toBe(POPULATION_HISTORY_LENGTH + 4);
  });

  it('grows with generations and resets when generation goes backwards', () => {
    const { setStats } = useUIStore.getState();
    setStats(stat(1, 10));
    setStats(stat(2, 20));
    setStats(stat(3, 30));
    expect(useUIStore.getState().populationHistory).toEqual([10, 20, 30]);
    setStats(stat(0, 99));
    expect(useUIStore.getState().populationHistory).toEqual([99]);
  });

  it('replaces the latest sample when the generation repeats', () => {
    const { setStats } = useUIStore.getState();
    setStats(stat(0, 5));
    setStats(stat(0, 8));
    expect(useUIStore.getState().populationHistory).toEqual([8]);
  });

  it('describes trend, now and range', () => {
    expect(describePopulationTrend([3900, 4200, 4620])).toBe(
      'Population rising, 4,620 now, range 3,900–4,620',
    );
    expect(describePopulationTrend([4700, 4000, 3900])).toContain('falling');
    expect(describePopulationTrend([100, 100, 100])).toContain('steady');
    expect(describePopulationTrend([50, 10, 0])).toBe('Population extinct, 0 now');
    expect(describePopulationTrend([7])).toBe('Population 7 now');
  });

  it('scales points to the window min/max', () => {
    expect(sparklinePoints([0, 10], 100, 20, 0)).toBe('0.0,20.0 100.0,0.0');
    expect(sparklinePoints([5], 100, 20)).toBe('');
  });
});

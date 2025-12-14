import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../../src/store/useUIStore';
import type { GameStats } from '../../src/store/useUIStore';

describe('useUIStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.setState({
      stats: {
        generation: 0,
        population: 0,
        birthsLastTick: 0,
        deathsLastTick: 0,
      },
    });
  });

  it('should have initial default stats', () => {
    const state = useUIStore.getState();
    expect(state.stats).toEqual({
      generation: 0,
      population: 0,
      birthsLastTick: 0,
      deathsLastTick: 0,
    });
  });

  it('should update stats via setStats', () => {
    const newStats: GameStats = {
      generation: 10,
      population: 100,
      birthsLastTick: 5,
      deathsLastTick: 3,
    };

    useUIStore.getState().setStats(newStats);

    const state = useUIStore.getState();
    expect(state.stats).toEqual(newStats);
  });

  it('should replace all stats when setStats is called', () => {
    // Set initial stats
    useUIStore.getState().setStats({
      generation: 10,
      population: 100,
      birthsLastTick: 5,
      deathsLastTick: 3,
    });

    // Replace with new stats
    const updatedStats: GameStats = {
      generation: 20,
      population: 200,
      birthsLastTick: 10,
      deathsLastTick: 7,
    };

    useUIStore.getState().setStats(updatedStats);

    const state = useUIStore.getState();
    expect(state.stats).toEqual(updatedStats);
  });
});

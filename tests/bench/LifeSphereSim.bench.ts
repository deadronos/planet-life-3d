import { describe, bench } from 'vitest';
import { LifeSphereSim } from '../../src/sim/LifeSphereSim';
import type { Rules } from '../../src/sim/rules';

// Standard Game of Life Rules: B3/S23
const GOL_RULES: Rules = {
  birth: [false, false, false, true, false, false, false, false, false],
  survive: [false, false, true, true, false, false, false, false, false],
};

function makeSim(latCells: number, lonCells: number, density = 0.35) {
  const sim = new LifeSphereSim({
    latCells,
    lonCells,
    planetRadius: 10,
    cellLift: 0,
    rules: GOL_RULES,
  });
  sim.randomize(density);
  return sim;
}

function makeSimColony(latCells: number, lonCells: number, density = 0.35) {
  const sim = new LifeSphereSim({
    latCells,
    lonCells,
    planetRadius: 10,
    cellLift: 0,
    rules: GOL_RULES,
  });
  sim.setGameMode('Colony');
  sim.randomize(density);
  return sim;
}

describe('LifeSphereSim.step (bench)', () => {
  // Keep sizes modest so `npm run bench` stays fast on laptops.
  const sim64x128 = makeSim(64, 128);
  const sim128x256 = makeSim(128, 256);

  const simColony64x128 = makeSimColony(64, 128);
  const simColony128x256 = makeSimColony(128, 256);

  bench('Classic 64x128', () => {
    sim64x128.step();
  });

  bench('Classic 128x256', () => {
    sim128x256.step();
  });

  bench('Colony 64x128', () => {
    simColony64x128.step();
  });

  bench('Colony 128x256', () => {
    simColony128x256.step();
  });
});

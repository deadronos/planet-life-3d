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

describe('LifeSphereSim.step (bench)', () => {
  // Keep sizes modest so `npm run bench` stays fast on laptops.
  const sim64x128 = makeSim(64, 128);
  const sim128x256 = makeSim(128, 256);
  const sim192x384 = makeSim(192, 384);

  bench('step 64x128', () => {
    sim64x128.step();
  });

  bench('step 128x256', () => {
    sim128x256.step();
  });

  bench('step 192x384', () => {
    sim192x384.step();
  });
});

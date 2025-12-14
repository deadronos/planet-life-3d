import { LifeGridSim } from '../sim/LifeGridSim';
import type {
  LifeGridWorkerInMessage,
  LifeGridWorkerOutMessage,
  LifeGridWorkerSnapshot,
} from './lifeGridWorkerMessages';

type PostMessage = (message: LifeGridWorkerOutMessage, transfer?: Transferable[]) => void;

type BufferTriple = {
  grid: ArrayBuffer;
  age: ArrayBuffer;
  heat: ArrayBuffer;
};

export function createLifeGridWorkerHandler(postMessage: PostMessage) {
  let sim: LifeGridSim | null = null;
  let pool: BufferTriple[] = [];

  const sendError = (message: string) => {
    postMessage({ type: 'error', message });
  };

  const takeBuffers = (cellCount: number): BufferTriple => {
    const candidate = pool.pop();
    if (
      candidate &&
      candidate.grid.byteLength === cellCount &&
      candidate.age.byteLength === cellCount &&
      candidate.heat.byteLength === cellCount
    ) {
      return candidate;
    }
    return {
      grid: new ArrayBuffer(cellCount),
      age: new ArrayBuffer(cellCount),
      heat: new ArrayBuffer(cellCount),
    };
  };

  const sendSnapshot = () => {
    if (!sim) return;
    const cellCount = sim.cellCount;
    const buffers = takeBuffers(cellCount);

    // Copy into recycle-able snapshot buffers. We transfer these buffers to the main thread.
    new Uint8Array(buffers.grid).set(sim.getGridView());
    new Uint8Array(buffers.age).set(sim.getAgeView());
    new Uint8Array(buffers.heat).set(sim.getNeighborHeatView());

    const payload: LifeGridWorkerSnapshot = {
      type: 'snapshot',
      grid: buffers.grid,
      age: buffers.age,
      heat: buffers.heat,
      generation: sim.generation,
      population: sim.population,
      birthsLastTick: sim.birthsLastTick,
      deathsLastTick: sim.deathsLastTick,
    };

    postMessage(payload, [buffers.grid, buffers.age, buffers.heat]);
  };

  const onMessage = (msg: LifeGridWorkerInMessage) => {
    try {
      switch (msg.type) {
        case 'init': {
          sim = new LifeGridSim({
            latCells: msg.latCells,
            lonCells: msg.lonCells,
            rules: msg.rules,
          });
          pool = [];
          if (typeof msg.randomDensity === 'number') sim.randomize(msg.randomDensity);
          postMessage({ type: 'ready' });
          sendSnapshot();
          return;
        }
        case 'setRules': {
          if (!sim) return sendError('Worker not initialized');
          sim.setRules(msg.rules);
          return;
        }
        case 'clear': {
          if (!sim) return sendError('Worker not initialized');
          sim.clear();
          sendSnapshot();
          return;
        }
        case 'randomize': {
          if (!sim) return sendError('Worker not initialized');
          sim.randomize(msg.density);
          sendSnapshot();
          return;
        }
        case 'seedAtCell': {
          if (!sim) return sendError('Worker not initialized');
          sim.seedAtCell({
            lat: msg.lat,
            lon: msg.lon,
            offsets: msg.offsets,
            mode: msg.mode,
            scale: msg.scale,
            jitter: msg.jitter,
            probability: msg.probability,
            debug: msg.debug,
          });
          sendSnapshot();
          return;
        }
        case 'tick': {
          if (!sim) return sendError('Worker not initialized');
          const steps = Math.max(1, Math.floor(msg.steps ?? 1));
          for (let i = 0; i < steps; i++) sim.step();
          sendSnapshot();
          return;
        }
        case 'recycle': {
          // Main thread returns transferred buffers for re-use.
          pool.push({ grid: msg.grid, age: msg.age, heat: msg.heat });
          return;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendError(message);
    }
  };

  return { onMessage };
}

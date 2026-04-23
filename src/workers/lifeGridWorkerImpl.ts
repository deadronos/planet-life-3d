import { LifeGridSim } from '../sim/LifeGridSim';
import type {
  LifeGridWorkerInMessage,
  LifeGridWorkerOutMessage,
  LifeGridWorkerSnapshot,
} from './lifeGridWorkerMessages';

type PostMessage = (message: LifeGridWorkerOutMessage, transfer?: Transferable[]) => void;

type BufferQuad = {
  grid: ArrayBuffer;
  age: ArrayBuffer;
  heat: ArrayBuffer;
  aliveIndices: ArrayBuffer;
};

export function createLifeGridWorkerHandler(postMessage: PostMessage) {
  let sim: LifeGridSim | null = null;
  let pool: BufferQuad[] = [];

  const sendError = (message: string) => {
    postMessage({ type: 'error', message });
  };

  const takeBuffers = (cellCount: number): BufferQuad => {
    const candidate = pool.pop();
    if (
      candidate &&
      candidate.grid.byteLength === cellCount &&
      candidate.age.byteLength === cellCount &&
      candidate.heat.byteLength === cellCount &&
      candidate.aliveIndices.byteLength === cellCount * 4
    ) {
      return candidate;
    }
    return {
      grid: new ArrayBuffer(cellCount),
      age: new ArrayBuffer(cellCount),
      heat: new ArrayBuffer(cellCount),
      aliveIndices: new ArrayBuffer(cellCount * 4), // Int32Array
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

    // Copy only the active portion of the alive indices or the whole buffer?
    // For simplicity and to maintain fixed size buffers for the pool, we copy the whole thing.
    // The main thread will use the population count to know how much to read.
    new Int32Array(buffers.aliveIndices).set(sim.getAliveIndicesView());

    const payload: LifeGridWorkerSnapshot = {
      type: 'snapshot',
      grid: buffers.grid,
      age: buffers.age,
      heat: buffers.heat,
      aliveIndices: buffers.aliveIndices,
      generation: sim.generation,
      population: sim.population,
      birthsLastTick: sim.birthsLastTick,
      deathsLastTick: sim.deathsLastTick,
    };

    postMessage(payload, [buffers.grid, buffers.age, buffers.heat, buffers.aliveIndices]);
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
          if (msg.gameMode) sim.setGameMode(msg.gameMode);
          if (msg.ecologyProfile) sim.setEcologyProfile(msg.ecologyProfile);
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
        case 'setGameMode': {
          if (!sim) return sendError('Worker not initialized');
          sim.setGameMode(msg.mode);
          return;
        }
        case 'setEcologyProfile': {
          if (!sim) return sendError('Worker not initialized');
          sim.setEcologyProfile(msg.profile);
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
          pool.push({
            grid: msg.grid,
            age: msg.age,
            heat: msg.heat,
            aliveIndices: msg.aliveIndices,
          });
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

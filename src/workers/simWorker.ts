import { createLifeGridWorkerHandler } from './lifeGridWorkerImpl';
import type { LifeGridWorkerInMessage } from './lifeGridWorkerMessages';

type WorkerScope = {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  onmessage: ((ev: MessageEvent) => void) | null;
};

// Vite worker entrypoint. Keep typings minimal so this compiles under the app's DOM tsconfig.
const ctx = self as unknown as WorkerScope;

const handler = createLifeGridWorkerHandler((message, transfer) => {
  ctx.postMessage(message, transfer);
});

ctx.onmessage = (event) => {
  handler.onMessage(event.data as LifeGridWorkerInMessage);
};

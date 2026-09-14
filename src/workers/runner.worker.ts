/// <reference lib="webworker" />
/**
 * The model runner Web Worker. All logic is in host.ts (tested with a fake port); this file only
 * connects it to the worker's global scope. Created by src/workers/client.ts with
 * `new Worker(new URL('./runner.worker.ts', import.meta.url), { type: 'module' })`.
 */

import { createRunnerHost } from './host';
import type { FromRunner, ToRunner } from './protocol';

const scope = self as unknown as { postMessage: (m: FromRunner) => void; onmessage: ((ev: MessageEvent<ToRunner>) => void) | null };

createRunnerHost({
  post: (msg) => scope.postMessage(msg),
  listen: (handler) => {
    scope.onmessage = (ev) => handler(ev.data);
  },
});

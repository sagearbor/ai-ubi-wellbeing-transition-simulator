/** Presentation identity only. Numerical jobs and their replay format remain unchanged. */
import type { CoreModel } from '../../src/core/types';
import type { PolicyDraft } from '../../src/policy/types';
import type { PolicyResultEntry } from './PolicyResults';
import type { ModelStatus } from './importState';
export type AttemptStatus = 'empty' | 'ready' | 'running' | 'failed' | 'cancelled';
export const POLICY_VIEW_CAPABILITIES = { charts: true, map: false, corporations: false, futures: false } as const;
export interface ActiveRunView {
  capabilities: typeof POLICY_VIEW_CAPABILITIES;
  origin: string;
  family: 'lab-policy';
  key: string;
  slot: number;
  status: AttemptStatus | 'stale';
  model: CoreModel;
  modelStatus: ModelStatus;
  source: PolicyDraft['source'] | null;
  review: string;
  coverage: string;
  scope: string;
  limitations: string[];
  entries: PolicyResultEntry[];
}
export const unsupportedPolicyView = 'This policy calculation has no explicit country or corporation mapping, and supplies no AI risk effects. Its supported alternate view is Charts, using its own calendar.';
/** Revocation guards completion AND progress, including cancellation races and unmount. */
export function createAttemptGate() {
  let sequence = 0;
  let cancel: (() => void) | undefined;
  return {
    begin() { const previous = cancel; cancel = undefined; const id = ++sequence; previous?.(); return id; },
    owns(id: number) { return sequence === id; },
    attach(id: number, fn: () => void) { if (sequence === id) cancel = fn; else fn(); },
    revoke() { ++sequence; const previous = cancel; cancel = undefined; previous?.(); },
  };
}

/** Attach an asynchronous job to its already-created attempt. Rejected promises are terminal too. */
export function observeAttempt<T>(gate: ReturnType<typeof createAttemptGate>, token: number,
  start: (progress: (value: unknown) => void) => { promise: Promise<T>; cancel: () => void },
  callbacks: { progress: (value: unknown) => void; complete: (value: T) => void; error: (error: unknown) => void }) {
  const handle = start(value => { if (gate.owns(token)) callbacks.progress(value); });
  gate.attach(token, handle.cancel);
  handle.promise.then(value => { if (gate.owns(token)) callbacks.complete(value); }, error => { if (gate.owns(token)) callbacks.error(error); });
  return handle;
}

export function ownsContext(gate: ReturnType<typeof createAttemptGate>, token: number, started: string, current: string): boolean {
  return gate.owns(token) && started === current;
}

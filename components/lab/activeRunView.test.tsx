import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createAttemptGate, observeAttempt, ownsContext, POLICY_VIEW_CAPABILITIES } from './activeRunView';
import PolicyResults from './PolicyResults';
import ActivePolicyResultView from './ActivePolicyResultView';
import { CORE_FIXTURES } from '../../src/core/fixtures';
import type { PairedRunResult } from '../../src/policy/types';

function controlled() {
  let resolve!: (value: string) => void;
  let reject!: (reason: Error) => void;
  let progress!: (value: unknown) => void;
  const cancel = vi.fn();
  const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
  return { resolve: (v: string) => resolve(v), reject: (v: Error) => reject(v), progress: (v: unknown) => progress(v), cancel,
    start: (fn: (value: unknown) => void) => { progress = fn; return { promise, cancel }; } };
}
describe('active policy asynchronous attempt ownership', () => {
  it('ignores superseded completion and progress while the newer run remains active', async () => {
    const gate = createAttemptGate(); const a = controlled(); const b = controlled();
    const events: string[] = [];
    const callbacks = { progress: (v: unknown) => events.push(`progress:${v}`), complete: (v: string) => events.push(v), error: vi.fn() };
    observeAttempt(gate, gate.begin(), a.start, callbacks);
    observeAttempt(gate, gate.begin(), b.start, callbacks);
    expect(a.cancel).toHaveBeenCalledOnce();
    a.progress('old'); a.resolve('old complete'); await Promise.resolve();
    expect(events).toEqual([]);
    b.progress('new'); b.resolve('new complete'); await Promise.resolve();
    expect(events).toEqual(['progress:new', 'new complete']);
  });
  it('revokes cancelled and unmounted attempts even if the runner later succeeds', async () => {
    const gate = createAttemptGate(); const run = controlled(); const complete = vi.fn(); const progress = vi.fn();
    observeAttempt(gate, gate.begin(), run.start, { complete, progress, error: vi.fn() });
    gate.revoke(); run.progress(1); run.resolve('late'); await Promise.resolve();
    expect(run.cancel).toHaveBeenCalledOnce(); expect(complete).not.toHaveBeenCalled(); expect(progress).not.toHaveBeenCalled();
  });
  it('reports current asynchronous failure without adopting an old successful value', async () => {
    const gate = createAttemptGate(); const old = controlled(); const retry = controlled(); const complete = vi.fn(); const error = vi.fn();
    const callbacks = { complete, error, progress: vi.fn() };
    observeAttempt(gate, gate.begin(), old.start, callbacks); old.resolve('success'); await Promise.resolve();
    observeAttempt(gate, gate.begin(), retry.start, callbacks); retry.reject(new Error('failed retry')); await Promise.resolve();
    expect(complete).toHaveBeenCalledTimes(1); expect(error).toHaveBeenCalledOnce();
  });
});
describe('selected policy presentation', () => {
  const model = CORE_FIXTURES[0].model;
  const good = { ok: true, errors: [] } as unknown as PairedRunResult;
  it('never substitutes available A for missing B', () => {
    const html = renderToString(<PolicyResults model={model} entries={[{slot: 0, label: 'A', result: good, stale: false}]} active={-1} year={null} onYear={() => {}} />);
    expect(html).toContain('another draft is not substituted');
  });
  it('never displays stale selected values', () => {
    const html = renderToString(<PolicyResults model={model} entries={[{label:'A', result:good, stale:true}]} active={0} year={null} onYear={() => {}} />);
    expect(html).toContain('no current successful result');
  });
  it.each(['running','failed','cancelled','stale'] as const)('keeps model/source identity but hides prior numbers when %s', status => {
    const html = renderToString(<ActivePolicyResultView view={{capabilities:POLICY_VIEW_CAPABILITIES,origin:'fixture',family:'lab-policy',key:'exact-input-key',slot:1,status,model,modelStatus:'curated',source:{title:'Pinned source',excerptChars:0},review:'author-drafted',coverage:'source unavailable — coverage unknown',scope:'own scope',limitations:['Unresolved effects omitted'],entries:[{label:'A',result:good,stale:false}]}} onAuthor={() => {}} onWorld={() => {}} />);
    expect(html).toContain('Pinned source'); expect(html).toContain('source unavailable'); expect(html).toContain('No current successful calculation'); expect(html).not.toContain('World simulation');
  });
});

describe('deferred extraction ownership', () => {
  it.each(['new source', 'new model', 'manual draft', 'worked example', 'edited mapping'])('ignores extraction after %s replaces its context', async change => {
    const gate = createAttemptGate(); const token = gate.begin(); let live = 'initial source/model/draft';
    const captured = live; const apply = vi.fn(); let resolve!: (value: string) => void;
    const response = new Promise<string>(yes => { resolve = yes; });
    const pending = response.then(value => { if (ownsContext(gate,token,captured,live)) apply(value); });
    live = change; resolve('old extraction'); await pending; expect(apply).not.toHaveBeenCalled();
  });
  it('ignores an extraction that completes after unmount', async () => {
    const gate = createAttemptGate(); const token = gate.begin(); const apply = vi.fn();
    const pending = Promise.resolve('extracted').then(value => { if (ownsContext(gate,token,'same','same')) apply(value); });
    gate.revoke(); await pending; expect(apply).not.toHaveBeenCalled();
  });
});

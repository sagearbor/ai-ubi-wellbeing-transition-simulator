import { describe, it, expect } from 'vitest';
import {
  checkLedger,
  computeLedger,
  deriveStatus,
  recordComputed,
  renderLedgerMarkdown,
  withinTolerance,
  KNOWN_MISS_PINS,
  type CheckInput,
  type ComputeResult,
  type Ledger,
  type LedgerEntry,
} from './ledger';

const entry = (over: Partial<LedgerEntry> = {}): LedgerEntry => ({
  id: 'x',
  family: 'other',
  source: { citation: 'Paper', locator: 'Table 1' },
  quantity: 'q',
  units: 'u',
  published: { value: 10 },
  model: { value: null, computed: false },
  discrepancy: null,
  tolerance: { kind: 'abs', value: 1, setBy: 'test author' },
  status: 'reproduced',
  checkedBy: ['a.test.ts:1'],
  compute: { kind: 'derived', fn: 'none' },
  ...over,
});

const ledgerOf = (entries: LedgerEntry[], over: Partial<Ledger> = {}): Ledger => ({
  schemaVersion: 1,
  description: 'fixture',
  exclusions: [],
  scanExemptions: [],
  entries,
  ...over,
});

const results = (pairs: Array<[string, ComputeResult]>) => new Map(pairs);

const check = (over: Partial<CheckInput>) =>
  checkLedger({ current: ledgerOf([]), computed: new Map(), testFiles: {}, targetKeys: [], ...over });

describe('status derivation', () => {
  it('abs and relative tolerances, inclusive at the edge', () => {
    expect(withinTolerance(11, 10, { kind: 'abs', value: 1, setBy: 's' })).toBe(true);
    expect(withinTolerance(11.01, 10, { kind: 'abs', value: 1, setBy: 's' })).toBe(false);
    expect(withinTolerance(10.3, 10, { kind: 'relative', value: 0.03, setBy: 's' })).toBe(true);
    expect(withinTolerance(10.39, 10, { kind: 'relative', value: 0.03, setBy: 's' })).toBe(false);
  });

  it('bounds: the published value is the bound; strict vs non-strict', () => {
    expect(withinTolerance(0.578, 0.6, { kind: 'gt', setBy: 's' })).toBe(false);
    expect(withinTolerance(0.6, 0.6, { kind: 'gt', setBy: 's' })).toBe(false);
    expect(withinTolerance(0.6, 0.6, { kind: 'gte', setBy: 's' })).toBe(true);
    expect(withinTolerance(-6, -5, { kind: 'lt', setBy: 's' })).toBe(true);
    expect(withinTolerance(5, 5, { kind: 'lte', setBy: 's' })).toBe(true);
  });

  it('non-finite values miss; no tolerance or no published value is undecidable', () => {
    expect(withinTolerance(NaN, 10, { kind: 'abs', value: 1, setBy: 's' })).toBe(false);
    expect(withinTolerance(10, 10, { kind: 'none', setBy: 's' })).toBeNull();
    expect(withinTolerance(10, null, { kind: 'abs', value: 1, setBy: 's' })).toBeNull();
  });

  it('reproduced, reproduced-with-caveat and missed from the value', () => {
    expect(deriveStatus(entry(), { value: 10.5 })).toBe('reproduced');
    expect(deriveStatus(entry({ caveat: 'timing mismatch' }), { value: 10.5 })).toBe('reproduced-with-caveat');
    // A caveat never rescues a miss.
    expect(deriveStatus(entry({ caveat: 'timing mismatch' }), { value: 12 })).toBe('missed');
  });

  it('a classification wins over the value; a harness-forced status wins over both', () => {
    expect(deriveStatus(entry({ classification: 'not-verified' }), { value: 10 })).toBe('not-verified');
    expect(deriveStatus(entry({ classification: 'not-checked' }), undefined)).toBe('not-checked');
    expect(deriveStatus(entry({ classification: 'not-checked' }), { value: 0, forcedStatus: 'outside-model' })).toBe('outside-model');
  });

  it('undecidable without a value or without a tolerance', () => {
    expect(deriveStatus(entry(), { value: null })).toBeNull();
    expect(deriveStatus(entry(), undefined)).toBeNull();
    expect(deriveStatus(entry({ tolerance: { kind: 'none', setBy: 's' } }), { value: 10 })).toBeNull();
  });
});

describe('recording', () => {
  it('writes value, discrepancy and derived status, lists status changes, and leaves failed or skipped entries alone', () => {
    const l = ledgerOf([
      entry({ id: 'fixed', status: 'missed' }),
      entry({ id: 'broken', model: { value: 3, computed: true } }),
      entry({ id: 'skipped', model: { value: 4, computed: true } }),
      entry({ id: 'gone', retired: { date: '2026-09-14', reason: 'superseded' } }),
    ]);
    const { ledger, changes } = recordComputed(l, results([
      ['fixed', { value: 10.1234567 }],
      ['broken', { value: null, error: 'renamed test' }],
      ['skipped', { value: null, skipped: 'no data' }],
      ['gone', { value: 99 }],
    ]));
    const byId = Object.fromEntries(ledger.entries.map((e) => [e.id, e]));
    expect(byId.fixed.status).toBe('reproduced');
    expect(byId.fixed.model).toEqual({ value: 10.1235, computed: true });
    expect(byId.fixed.discrepancy).toBeCloseTo(0.123457, 6);
    expect(changes).toEqual(['fixed: missed -> reproduced']);
    expect(byId.broken.model.value).toBe(3);
    expect(byId.skipped.model.value).toBe(4);
    expect(byId.gone.model.value).toBeNull();
  });
});

describe('check rule (a): no target disappears without a retirement reason', () => {
  it('fails when an id present at the comparison base is gone', () => {
    const prev = ledgerOf([entry({ id: 'kept' }), entry({ id: 'dropped' })]);
    const r = check({ current: ledgerOf([entry({ id: 'kept', compute: null, status: 'not-checked' })]), previous: [prev] });
    expect(r.failures.map((f) => [f.rule, f.id])).toEqual([['a', 'dropped']]);
  });

  it('accepts a retired entry with a reason, rejects one without', () => {
    const prev = ledgerOf([entry({ id: 'old' })]);
    const ok = check({ current: ledgerOf([entry({ id: 'old', retired: { date: '2026-09-14', reason: 'paper revised' } })]), previous: [prev] });
    expect(ok.failures).toEqual([]);
    const bad = check({ current: ledgerOf([entry({ id: 'old', retired: { date: '2026-09-14', reason: ' ' } })]), previous: [prev] });
    expect(bad.failures.map((f) => f.message)).toEqual(['retired without a reason']);
  });

  it('fails when a harness still declares a target no entry covers, unless it is excluded with a reason', () => {
    const current = ledgerOf([entry({ id: 'e', compute: null, status: 'not-checked', covers: ['kj:modest:gdpBoostPct'] })], {
      exclusions: [{ pattern: '^infile:minimal::', reason: 'synthetic' }],
    });
    const r = check({ current, targetKeys: ['kj:modest:gdpBoostPct', 'infile:minimal::income compounds', 'anchor:AT-9'] });
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toMatchObject({ rule: 'a' });
    expect(r.failures[0].message).toContain('anchor:AT-9');
  });

  it('fails when a checkedBy file no longer exists', () => {
    const r = check({ current: ledgerOf([entry({ compute: null, status: 'not-checked', checkedBy: ['gone.test.ts:3'] })]), existingFiles: new Set(['a.test.ts']) });
    expect(r.failures.map((f) => f.rule)).toEqual(['a']);
  });
});

describe('check rule (b): computed status must equal the recorded status', () => {
  it('fails on a new miss and on a silent fix', () => {
    const current = ledgerOf([entry({ id: 'newMiss', status: 'reproduced' }), entry({ id: 'silentFix', status: 'missed' })]);
    const r = check({ current, computed: results([['newMiss', { value: 20 }], ['silentFix', { value: 10 }]]) });
    expect(r.failures.map((f) => [f.rule, f.id])).toEqual([['b', 'newMiss'], ['b', 'silentFix']]);
  });

  it('passes when they agree, and only warns when the value drifts with the status unchanged', () => {
    const current = ledgerOf([entry({ id: 'e', status: 'reproduced', model: { value: 10.2, computed: true } })]);
    const r = check({ current, computed: results([['e', { value: 10.4 }]]) });
    expect(r.failures).toEqual([]);
    expect(r.warnings.join()).toContain('drifted');
  });

  it('a computation that breaks is a failure; one that was not attempted is a warning', () => {
    const current = ledgerOf([entry({ id: 'broken' }), entry({ id: 'skipped', status: 'not-checked' }), entry({ id: 'missing' })]);
    const r = check({ current, computed: results([['broken', { value: null, error: 'in-file test not found' }], ['skipped', { value: null, skipped: 'no hindcast data' }]]) });
    expect(r.failures.map((f) => f.id)).toEqual(['broken', 'missing']);
    expect(r.warnings.join()).toContain('skipped: not computed');
  });

  it('retired entries are not recomputed or compared', () => {
    const r = check({ current: ledgerOf([entry({ status: 'reproduced', retired: { date: 'd', reason: 'r' } })]), computed: results([['x', { value: 99 }]]) });
    expect(r.failures).toEqual([]);
  });

  it('an entry with no tolerance must carry a classification', () => {
    const r = check({ current: ledgerOf([entry({ compute: null, status: 'not-checked', tolerance: { kind: 'none', setBy: 'nobody' } })]) });
    expect(r.failures.map((f) => f.rule)).toEqual(['schema']);
  });
});

describe('check rule (c): a test that pins a known miss must have its ledger entry', () => {
  const pin = KNOWN_MISS_PINS.find((p) => p.entryId === 'anchor-AT-3')!;
  const pinning = { [pin.file]: 'expect(at3?.passed).toBe(false);' };

  it('fails when the pinning test exists and the entry does not', () => {
    const r = check({ current: ledgerOf([entry({ id: 'other', compute: null, status: 'not-checked', checkedBy: [`${pin.file}:36`] })]), testFiles: pinning });
    expect(r.failures.map((f) => [f.rule, f.id])).toEqual([['c', 'anchor-AT-3']]);
  });

  it('fails when the entry records the pinned miss as reproduced', () => {
    const r = check({ current: ledgerOf([entry({ id: 'anchor-AT-3', compute: null, status: 'reproduced', checkedBy: [`${pin.file}:36`] })]), testFiles: pinning });
    expect(r.failures.map((f) => f.rule)).toEqual(['b', 'c']);
  });

  it('passes when the entry is recorded as missed; ignores the pin once the test no longer contains it', () => {
    const current = ledgerOf([entry({ id: 'anchor-AT-3', compute: null, status: 'missed', checkedBy: [`${pin.file}:36`] })]);
    expect(check({ current, testFiles: pinning }).failures).toEqual([]);
    expect(check({ current: ledgerOf([]), testFiles: { [pin.file]: 'expect(at3?.passed).toBe(true);' } }).failures).toEqual([]);
  });

  it('heuristic: an unreferenced test file that looks like it pins a miss fails unless exempted with a reason', () => {
    const files = { 'src/new.test.ts': "it('Fig. 9: this port misses the published reading', () => {})", 'src/clean.test.ts': 'expect(1).toBe(1)' };
    const flagged = check({ testFiles: files });
    expect(flagged.failures.map((f) => f.rule)).toEqual(['c']);
    expect(flagged.failures[0].message).toContain('src/new.test.ts');
    expect(check({ testFiles: files, current: ledgerOf([], { scanExemptions: [{ file: 'src/new.test.ts', reason: 'synthetic' }] }) }).failures).toEqual([]);
    expect(check({ testFiles: files, current: ledgerOf([entry({ compute: null, status: 'not-checked', checkedBy: ['src/new.test.ts:1'] })]) }).failures).toEqual([]);
  });
});

describe('computation (cheap harnesses only; hindcast is computed by the script)', () => {
  it('reads in-file tests and harness outputs, captures errors per entry, and skips hindcast without data', () => {
    const entries: LedgerEntry[] = [
      entry({ id: 'infile', published: { value: -0.007 }, tolerance: { kind: 'abs', value: 0.001, setBy: 's' }, compute: { kind: 'core-infile', model: 'alaska-pfd-calibration', test: 'AEJ p.335 net -0.007' } }),
      entry({ id: 'expr', published: { value: -0.007 }, compute: { kind: 'core-expr', model: 'alaska-pfd-calibration', at: 1990, expr: 'net_effect * 100' } }),
      entry({ id: 'renamed', compute: { kind: 'core-infile', model: 'alaska-pfd-calibration', test: 'no such test' } }),
      entry({ id: 'hc', compute: { kind: 'hindcast', run: 'ai-off', metric: 'maeWellbeing' } }),
    ];
    const r = computeLedger(entries);
    expect(r.get('infile')!.value).toBeCloseTo(-0.00724, 5);
    expect(r.get('expr')!.value).toBeCloseTo(-0.724, 3);
    expect(r.get('renamed')!.error).toMatch(/not found/);
    expect(r.get('hc')!.skipped).toBeTruthy();
    expect(deriveStatus(entries[0], r.get('infile'))).toBe('reproduced');
  });
});

describe('rendering', () => {
  it('is deterministic, groups by family and lists misses first', () => {
    const l = ledgerOf([
      entry({ id: 'a', family: 'hindcast', status: 'reproduced' }),
      entry({ id: 'b', family: 'alaska-pfd', status: 'missed', notes: 'pinned' }),
    ]);
    const md = renderLedgerMarkdown(l);
    expect(renderLedgerMarkdown(l)).toBe(md);
    expect(md.indexOf('## Misses')).toBeLessThan(md.indexOf('## alaska-pfd'));
    expect(md.indexOf('## alaska-pfd')).toBeLessThan(md.indexOf('## hindcast'));
    expect(md).toContain('| `b` | **missed** |');
  });
});

describe('success requires fresh evidence', () => {
  it('refuses non-finite targets and invalid tolerances', () => {
    expect(withinTolerance(10, Infinity, { kind: 'abs', value: Infinity, setBy: 'invalid' })).toBe(false);
    expect(withinTolerance(10, 10, { kind: 'abs', value: Infinity, setBy: 'invalid' })).toBe(false);
    expect(withinTolerance(10, 10, { kind: 'relative', value: -1, setBy: 'invalid' })).toBe(false);
  });

  it.each(['reproduced', 'reproduced-with-caveat'] as const)('refuses %s without computation or with skipped evidence', (status) => {
    for (const r of [undefined, { value: null, skipped: 'unavailable' }]) {
      const e = entry({ status, compute: r ? entry().compute : null });
      expect(check({ current: ledgerOf([e]), computed: r ? results([['x', r]]) : new Map() }).failures.length).toBeGreaterThan(0);
    }
  });
  it('full ledger retains known miss after compute deletion', async () => {
    const { readFileSync } = await import('node:fs');
    const { discoverTargetKeys } = await import('./ledger');
    const recorded = JSON.parse(readFileSync('data/ledger/reference-targets.json', 'utf8')) as Ledger;
    const current = structuredClone(recorded);
    const e = current.entries.find(e => e.id === 'gp-fig3a-p100-tau0.5')!;
    e.compute = null; e.status = 'reproduced-with-caveat'; e.caveat = 'still misses';
    const testFiles = Object.fromEntries(KNOWN_MISS_PINS.map(p => [p.file, readFileSync(p.file, 'utf8')]));
    const report = checkLedger({ current, previous: [recorded], computed: computeLedger(current.entries), testFiles, targetKeys: discoverTargetKeys() });
    expect(report.failures.some(f => f.id === e.id)).toBe(true);
    // Full numerical ledger under concurrent CI load; this is not a 30-second performance contract.
  }, 120000);
});

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runModel } from '../core/engine';
import type { CoreModel } from '../core/types';
import { ENGINE_VERSION } from '../core/engine';
import { coverage, draftToOverlay, expressionSymbols, pairedRun, quoteInSource, validateDraft, blankDraft, hasErrors, blockingErrors } from './draft';
import { canonicalJson, contentHash, modelHash, sha256Hex } from './hash';
import {
  SOURCE_TEXT,
  budgetProvision,
  cohort,
  draftFor,
  reportProvision,
  retraining,
  stipendProvision,
  threeStatusDraft,
  training,
} from './testDrafts';
import type { Provision } from './types';

const codes = (ds: { code: string; level: string }[], level?: string) => ds.filter((d) => !level || d.level === level).map((d) => d.code);

describe('hash', () => {
  it('matches the SHA-256 test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    // two blocks, and a UTF-8 multibyte character
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    for (const len of [1, 55, 56, 63, 64, 65, 119, 120, 1000]) {
      const text = 'aé€𝄞'.repeat(len).slice(0, len);
      expect(sha256Hex(text)).toBe(createHash('sha256').update(text, 'utf8').digest('hex'));
    }
  });

  it('is insensitive to key order and drops undefined', () => {
    expect(canonicalJson({ b: 1, a: [1, { d: undefined, c: 2 }] })).toBe('{"a":[1,{"c":2}],"b":1}');
    expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }));
    expect(modelHash(training)).toBe(modelHash(JSON.parse(JSON.stringify(training)) as CoreModel));
    expect(modelHash(training)).not.toBe(modelHash({ ...training, name: 'changed' }));
  });
});

describe('quotes and symbols', () => {
  it('finds a quote across line breaks and indentation, and only then', () => {
    expect(quoteInSource('appropriated $12,000,000 for each of fiscal years 2027', SOURCE_TEXT)).toBe(true);
    expect(quoteInSource('appropriated $13,000,000', SOURCE_TEXT)).toBe(false);
    expect(quoteInSource('   ', SOURCE_TEXT)).toBe(false);
  });

  it('reads identifiers but not function names, reserved words or exponents', () => {
    expect(expressionSymbols('1 + max(a, b[t-1]) * 1e-6 + year').sort()).toEqual(['a', 'b']);
  });
});

describe('coverage', () => {
  it('counts every status and says whether all are accounted for', () => {
    const c = coverage(threeStatusDraft());
    expect(c).toMatchObject({ total: 3, mapped: 1, unresolved: 1, outsideModel: 1, unaccounted: 0, allHaveStatus: true });
    expect(c.text).toBe('1 of 3 provisions mapped, 1 unresolved, 1 outside model');
    expect(c.statusText).toBe('every listed provision has a status');
    const broken = coverage({ provisions: [budgetProvision, { ...stipendProvision, status: undefined as unknown as Provision['status'] }] });
    expect(broken.allHaveStatus).toBe(false);
    expect(broken.text).toContain('1 with no status');
    expect(broken.statusText).toBe('1 listed provision has no status');
    expect(coverage({ provisions: [] }).allHaveStatus).toBe(false);
  });

  it('measures source coverage against the text, so deleting a provision cannot improve it', () => {
    const full = coverage(threeStatusDraft(), SOURCE_TEXT);
    expect(full.source).toMatchObject({ status: 'complete', clauses: 3, covered: 3, excluded: 0, uncovered: [] });
    expect(full.source.text).toBe('3 of 3 source clauses covered or explicitly excluded (3 by a provision quote, 0 excluded)');
    // the reviewer's probe: drop a difficult provision. The listed-status claim still holds; source coverage does not.
    const pruned = draftFor(training, [budgetProvision, stipendProvision]);
    expect(coverage(pruned, SOURCE_TEXT).allHaveStatus).toBe(true);
    expect(coverage(pruned, SOURCE_TEXT).source).toMatchObject({ status: 'incomplete', clauses: 3, covered: 2, uncovered: ['sec1(c)'] });
    // an explicit exclusion accounts for it instead, visibly
    const excluded = draftFor(training, [budgetProvision, stipendProvision], { exclusions: [{ clauseId: 'sec1(c)', kind: 'procedural', reason: 'A reporting duty.' }] });
    expect(coverage(excluded, SOURCE_TEXT).source).toMatchObject({ status: 'complete', covered: 2, excluded: 1 });
    // without the text, coverage is unknown and says so
    expect(coverage(threeStatusDraft()).source).toMatchObject({ status: 'source-unavailable', text: 'source unavailable — coverage unknown' });
    expect(coverage(threeStatusDraft(), `${SOURCE_TEXT} (edited)`).source.status).toBe('source-mismatch');
  });

  it('completeness is attested only by a named person, never by an AI or an agent', () => {
    expect(coverage(threeStatusDraft(), SOURCE_TEXT).completeness).toEqual({ attested: false, text: 'completeness not attested' });
    const person = threeStatusDraft({ completeness: { name: 'Jane Reviewer', kind: 'person', date: '2026-09-14', statement: 'Checked every clause.', textSha256: sha256Hex(SOURCE_TEXT) } });
    expect(coverage(person, SOURCE_TEXT).completeness).toMatchObject({ attested: true, text: 'completeness attested by Jane Reviewer on 2026-09-14' });
    expect(hasErrors(validateDraft(person, training, { sourceText: SOURCE_TEXT }))).toBe(false);

    const ai = threeStatusDraft({ reviewStatus: 'ai-drafted', draftedBy: { kind: 'ai', name: 'model-x' }, completeness: { name: 'model-x', kind: 'ai', date: '2026-09-14', statement: 'I covered everything.' } });
    expect(coverage(ai, SOURCE_TEXT).completeness.attested).toBe(false);
    expect(coverage(ai, SOURCE_TEXT).completeness.text).toContain('completeness not attested');
    expect(codes(validateDraft(ai, training, { sourceText: SOURCE_TEXT }), 'error')).toContain('attestation');
    const agent = threeStatusDraft({ completeness: { name: 'Claude Code', kind: 'agent', date: '2026-09-14', statement: 'Complete.' } });
    expect(codes(validateDraft(agent, training, { sourceText: SOURCE_TEXT }), 'error')).toContain('attestation');
    // an attestation of other text is void
    const stale = threeStatusDraft({ completeness: { ...person.completeness!, textSha256: sha256Hex('other text') } });
    expect(coverage(stale, SOURCE_TEXT).completeness.attested).toBe(false);
    // attested, but the inventory disagrees
    const contradicted = draftFor(training, [budgetProvision], { completeness: person.completeness });
    expect(codes(validateDraft(contradicted, training, { sourceText: SOURCE_TEXT }), 'warning')).toContain('attestation');
  });
});

describe('validateDraft', () => {
  it('accepts a clean three-status draft against its source', () => {
    const ds = validateDraft(threeStatusDraft(), training, { sourceText: SOURCE_TEXT });
    expect(codes(ds, 'error')).toEqual([]);
    expect(codes(ds, 'warning')).toEqual([]);
  });

  it('flags a quote that is not verbatim, and a source text whose hash differs', () => {
    const d = draftFor(training, [{ ...stipendProvision, quote: 'Each participant shall receive a generous stipend.' }]);
    expect(codes(validateDraft(d, training, { sourceText: SOURCE_TEXT }))).toContain('quote-not-found');
    expect(codes(validateDraft(d, training, { sourceText: `${SOURCE_TEXT} extra` }))).toContain('text-hash-mismatch');
    expect(codes(validateDraft(d, training))).toContain('quote-unchecked');
  });

  it('requires a status, a quote, and a reason for anything not mapped', () => {
    const d = draftFor(training, [
      { ...stipendProvision, id: 'a', status: 'maybe' as unknown as Provision['status'] },
      { ...stipendProvision, id: 'b', quote: '' },
      { ...reportProvision, id: 'c', reason: '' },
      { ...budgetProvision, id: 'd', mapping: undefined },
      { ...stipendProvision, id: 'a' },
    ]);
    const c = codes(validateDraft(d, training, { sourceText: SOURCE_TEXT }), 'error');
    expect(c).toEqual(expect.arrayContaining(['missing-status', 'empty-quote', 'missing-reason', 'missing-mapping', 'duplicate-provision-id']));
  });

  it('rejects unknown targets, wrong ops and effects on variables without hooks', () => {
    const bad = (mapping: Provision['mapping']): Provision => ({ ...budgetProvision, mapping });
    const ev = { label: 'x', kind: 'assumed' as const };
    const cases: Array<[Provision['mapping'], string]> = [
      [{ kind: 'parameter', target: 'nope', op: 'set', value: 1, evidence: ev }, 'unknown-target'],
      [{ kind: 'parameter', target: 'placement_rate', op: 'add', value: 1, evidence: ev }, 'bad-op'],
      [{ kind: 'input', target: 'training_budget', op: 'set', evidence: ev }, 'bad-value'],
      [{ kind: 'effect', target: 'placements', op: 'add', expr: 'ghost * 2', evidence: ev }, 'unknown-target'],
      [{ kind: 'effect', target: 'missing_var', op: 'add', expr: '1', evidence: ev }, 'unknown-target'],
      [{ kind: 'input', target: 'training_budget', op: 'add', value: 1, evidence: { label: '' } }, 'missing-source'],
    ];
    for (const [mapping, code] of cases) {
      expect(codes(validateDraft(draftFor(training, [bad(mapping)]), training), 'error')).toContain(code);
    }
    const noHook: CoreModel = { ...training, variables: training.variables.map((v) => (v.id === 'placements' ? { ...v, hook: false } : v)) };
    const d = draftFor(noHook, [bad({ kind: 'effect', target: 'placements', op: 'add', expr: '1', evidence: ev })]);
    expect(codes(validateDraft(d, noHook), 'error')).toContain('no-hook');
  });

  it('blocks unconvertible or missing units, and converts the rest', () => {
    const add = (value: number, unit?: string): Provision => ({ ...budgetProvision, id: `add-${unit ?? 'none'}`, mapping: { ...budgetProvision.mapping!, op: 'add', value, curve: undefined, unit } });
    expect(codes(validateDraft(draftFor(training, [add(1, 'eur')]), training), 'error')).toContain('unit-mismatch');
    expect(codes(validateDraft(draftFor(training, [add(20, 'people')]), training), 'error')).toContain('unit-mismatch');
    expect(codes(validateDraft(draftFor(training, [add(20)]), training), 'error')).toContain('unit-missing');
    const ok = validateDraft(draftFor(training, [add(20, 'million usd')]), training);
    expect(codes(ok, 'error')).toEqual([]);
    expect(ok.find((d) => d.code === 'unit-converted')?.message).toContain('20 million usd → training_budget (usd): converted to 20,000,000');
    // a per-year amount in a yearly model: accepted with the assumption named; per month into a yearly step: blocked
    expect(codes(validateDraft(draftFor(training, [add(20, 'million usd per year')]), training), 'warning')).toContain('unit-assumed');
    expect(codes(validateDraft(draftFor(training, [add(2, 'million usd per month')]), training), 'error')).toContain('unit-mismatch');
    // a one-off amount never becomes a per-step flow silently
    expect(codes(validateDraft(draftFor(training, [add(20, 'million usd one-off')]), training), 'error')).toContain('unit-mismatch');
    // percent into a share parameter
    const rate: Provision = { ...budgetProvision, id: 'rate', role: 'control', mapping: { kind: 'parameter', target: 'placement_rate', op: 'set', value: 60, unit: 'percent', evidence: { label: 'x', kind: 'assumed' } } };
    expect(draftToOverlay(draftFor(training, [rate]), training).parameters![0].value).toBeCloseTo(0.6, 12);
    // a multiplier with a unit is an error
    const mult: Provision = { ...budgetProvision, id: 'mult', role: 'coefficient', mapping: { kind: 'effect', target: 'placements', op: 'multiply', expr: '1.1', unit: 'usd', evidence: { label: 'x', kind: 'assumed' } } };
    expect(codes(validateDraft(draftFor(training, [mult]), training), 'error')).toContain('unit-mismatch');
  });

  it("the reviewer's case: a budget of 20 in million usd runs as $20,000,000, never $20", () => {
    const twenty: Provision = { ...budgetProvision, mapping: { ...budgetProvision.mapping!, curve: undefined, value: 20, unit: 'million usd' } };
    const draft = draftFor(training, [twenty]);
    const overlay = draftToOverlay(draft, training);
    expect(overlay.inputs![0].curve).toEqual({ '2026': 20_000_000 });
    const r = pairedRun(training, [], draft, { runs: 3, seed: 1 });
    expect(r.ok).toBe(true);
    // capacity (not $20) limits completions: 20,000,000 / 5,000 = 4,000 > 3,000 instructors
    expect(r.point.policy._.completions[0]).toBe(3000);
    expect(r.manifest.conversions).toEqual(['fund: 20 million usd → training_budget (usd): converted to 20,000,000']);
    // an effect written in thousands of people is scaled into people
    const eff: Provision = { ...budgetProvision, id: 'eff', role: 'coefficient', mapping: { kind: 'effect', target: 'placements', op: 'add', expr: '0.1', unit: 'thousand people', evidence: { label: 'x', kind: 'assumed' } } };
    const o = draftToOverlay(draftFor(training, [eff]), training);
    expect(o.effects![0]).toMatchObject({ expr: '(0.1) * 1000', unit: 'people' });
  });

  it('two setters of one target must agree; a set and an add must say how they stack', () => {
    const setA: Provision = { ...budgetProvision, id: 'setA', mapping: { ...budgetProvision.mapping!, curve: undefined, value: 12, unit: 'million usd' } };
    const setSame: Provision = { ...budgetProvision, id: 'setSame', mapping: { ...budgetProvision.mapping!, curve: undefined, value: 12_000_000, unit: 'usd' } };
    const setOther: Provision = { ...budgetProvision, id: 'setOther', mapping: { ...budgetProvision.mapping!, curve: undefined, value: 15_000_000, unit: 'usd' } };
    const conflict = validateDraft(draftFor(training, [setA, setOther]), training);
    expect(codes(conflict, 'error')).toContain('conflicting-setters');
    expect(conflict.find((d) => d.code === 'conflicting-setters')!.message).toContain('12,000,000');
    // equal after unit conversion: a duplicate, applied once
    const same = validateDraft(draftFor(training, [setA, setSame]), training);
    expect(codes(same, 'error')).toEqual([]);
    expect(codes(same, 'warning')).toContain('duplicate-target');
    // parameters too
    const p = (id: string, value: number): Provision => ({ ...budgetProvision, id, role: 'control', mapping: { kind: 'parameter', target: 'suitable_openings', op: 'set', value, unit: 'people', evidence: { label: 'x', kind: 'assumed' } } });
    expect(codes(validateDraft(draftFor(training, [p('p1', 1000), p('p2', 2000)]), training), 'error')).toContain('conflicting-setters');

    // set + add without stacksOn: ambiguous, blocked. With stacksOn: sets first, then the add, in any order.
    const add: Provision = { ...budgetProvision, id: 'add', mapping: { ...budgetProvision.mapping!, op: 'add', curve: undefined, value: 1, unit: 'million usd' } };
    expect(codes(validateDraft(draftFor(training, [add, setA]), training), 'error')).toContain('set-add-ambiguous');
    const stacked: Provision = { ...add, mapping: { ...add.mapping!, stacksOn: 'setA' } };
    const draft = draftFor(training, [stacked, setA]);
    expect(codes(validateDraft(draft, training), 'error')).toEqual([]);
    expect(draftToOverlay(draft, training).inputs![0].curve).toEqual({ '2026': 13_000_000 });
    // stacksOn must name a set of the same target
    const wrong: Provision = { ...add, mapping: { ...add.mapping!, stacksOn: 'nope' } };
    expect(codes(validateDraft(draftFor(training, [wrong, setA]), training), 'error')).toContain('bad-stack');
    // two adds are summed, with a warning
    const adds = validateDraft(draftFor(training, [add, { ...add, id: 'add2' }]), training);
    expect(codes(adds, 'error')).toEqual([]);
    expect(codes(adds, 'warning')).toContain('duplicate-target');
  });

  it('checks exclusions and definition links against the draft and the source inventory', () => {
    const d = draftFor(training, [budgetProvision, stipendProvision, { ...reportProvision, role: 'definition', interprets: ['fund', 'ghost'] }], {
      exclusions: [
        { clauseId: 'sec9(z)', kind: 'other', reason: 'x' },
        { clauseId: 'sec1(c)', kind: 'definition', reason: '' },
        { clauseId: 'sec1(c)', kind: 'weird' as 'other', reason: 'twice' },
      ],
    });
    const ds = validateDraft(d, training, { sourceText: SOURCE_TEXT });
    expect(codes(ds, 'error')).toEqual(expect.arrayContaining(['unknown-clause', 'bad-exclusion', 'duplicate-exclusion', 'unknown-interprets']));
    expect(codes(ds, 'warning')).toContain('definition-unlinked');
    // an ambiguous quote covers nothing and says so
    const twice = `${SOURCE_TEXT}\n    (d) Each participant shall receive a stipend.`;
    const amb = draftFor(training, [budgetProvision, stipendProvision, reportProvision], { source: { title: 'Test Act', textSha256: sha256Hex(twice), excerptChars: twice.length } });
    const ads = validateDraft(amb, training, { sourceText: twice });
    expect(codes(ads, 'warning')).toEqual(expect.arrayContaining(['quote-ambiguous', 'coverage-incomplete']));
  });

  it('never lets the policy text stand in as evidence for a response coefficient', () => {
    const coefficient = (kind: 'causal' | 'guess' | 'assumed' | undefined, url?: string): Provision => ({
      ...budgetProvision,
      id: 'response',
      role: 'coefficient',
      mapping: { kind: 'effect', target: 'placements', op: 'multiply', expr: '1.2', evidence: { label: 'Test Act says training works', kind, url } },
    });
    expect(codes(validateDraft(draftFor(training, [coefficient('causal', 'https://example.gov/test-act')]), training), 'error')).toContain('coefficient-from-source-text');
    expect(codes(validateDraft(draftFor(training, [coefficient('guess')]), training), 'warning')).toContain('coefficient-unsupported');
    expect(codes(validateDraft(draftFor(training, [coefficient(undefined)]), training), 'warning')).toContain('coefficient-unsupported');
    const assumed = validateDraft(draftFor(training, [coefficient('assumed')]), training);
    expect(codes(assumed, 'error')).toEqual([]);
    expect(codes(assumed, 'info')).toContain('coefficient-unsupported');
    // an effect labelled as a control is still a response
    const asControl = { ...coefficient('guess'), role: 'control' as const };
    const c = codes(validateDraft(draftFor(training, [asControl]), training), 'warning');
    expect(c).toEqual(expect.arrayContaining(['effect-not-coefficient', 'coefficient-unsupported']));
  });

  it('pins the model: a different model or version is an error', () => {
    const d = threeStatusDraft();
    expect(codes(validateDraft(d, cohort), 'error')).toContain('model-mismatch');
    const edited = { ...training, parameters: training.parameters.map((p) => (p.id === 'placement_rate' ? { ...p, value: 0.6 } : p)) };
    expect(codes(validateDraft(d, edited), 'error')).toContain('model-hash-mismatch');
  });

  it('keeps review status honest', () => {
    const noReviewer = threeStatusDraft({ reviewStatus: 'human-reviewed' });
    expect(codes(validateDraft(noReviewer, training), 'error')).toContain('review-status');
    const self = threeStatusDraft({ reviewStatus: 'human-reviewed', reviewedBy: { name: 'test author' } });
    expect(codes(validateDraft(self, training), 'error')).toContain('review-status');
    const ok = threeStatusDraft({ reviewStatus: 'human-reviewed', reviewedBy: { name: 'Someone Else' } });
    expect(codes(validateDraft(ok, training), 'error')).toEqual([]);
  });

  it('accepts targets that come from the scenario overlays', () => {
    const d = draftFor(cohort, [
      {
        id: 'participation',
        quote: 'Each participant shall receive a stipend.',
        summary: '',
        status: 'mapped',
        role: 'control',
        mapping: { kind: 'input', target: 'retrainingParticipation', op: 'set', value: 0.5, unit: 'share', evidence: { label: 'x', kind: 'assumed' } },
      },
    ]);
    expect(codes(validateDraft(d, cohort), 'error')).toContain('unknown-target');
    expect(codes(validateDraft(d, cohort, { overlays: [retraining] }), 'error')).toEqual([]);
  });

  it('validation governs execution: a draft with errors does not run, unresolved provisions do', () => {
    // the reviewer's draft: an invented quote and two conflicting budget setters
    const invented: Provision = { ...budgetProvision, id: 'invented', quote: 'There is appropriated $99,000,000 for training.', mapping: { ...budgetProvision.mapping!, curve: undefined, value: 99_000_000 } };
    const draft = draftFor(training, [budgetProvision, invented, stipendProvision]);
    const r = pairedRun(training, [], draft, { runs: 5, sourceText: SOURCE_TEXT });
    expect(r.ok).toBe(false);
    expect(r.blocked.map((x) => x.code)).toEqual(expect.arrayContaining(['quote-not-found', 'conflicting-setters']));
    expect(r.errors[0]).toContain('was not run');
    expect(r.years).toEqual([]);
    expect(r.manifest.baselineRunHash).toBe('');
    // without the text the quote cannot be checked, but the conflict still blocks
    expect(pairedRun(training, [], draft, { runs: 5 }).blocked.map((x) => x.code)).toEqual(['conflicting-setters']);
    // unresolved and outside-model provisions are not errors: they run and change nothing
    const omitted = draftFor(training, [stipendProvision, reportProvision]);
    const ok = pairedRun(training, [], omitted, { runs: 5, sourceText: SOURCE_TEXT });
    expect(ok.ok).toBe(true);
    expect(ok.blocked).toEqual([]);
    expect(blockingErrors(validateDraft(omitted, training, { sourceText: SOURCE_TEXT }))).toEqual([]);
  });

  it('a blank manual draft is valid and says nothing is mapped', () => {
    const d = blankDraft(training, { title: 'Pasted', text: SOURCE_TEXT }, { kind: 'person', name: 'Me' });
    const ds = validateDraft(d, training, { sourceText: SOURCE_TEXT });
    expect(hasErrors(ds)).toBe(false);
    expect(codes(ds, 'info')).toContain('nothing-mapped');
  });
});

describe('draftToOverlay', () => {
  it('only mapped provisions change the model, and add keeps the scenario curve', () => {
    const add: Provision = { ...budgetProvision, mapping: { ...budgetProvision.mapping!, op: 'add', value: 1_000_000, curve: undefined } };
    const o = draftToOverlay(draftFor(training, [add, stipendProvision, reportProvision]), training);
    expect(o.id).toBe('policy-test-draft');
    expect(o.inputs).toHaveLength(1);
    expect(o.inputs![0].curve).toEqual({ '2026': 7_000_000, '2027': 11_000_000, '2028': 12_000_000, '2029': 21_000_000 });
    expect(o.inputs![0].interp).toBe('step');
    expect(o.effects).toEqual([]);
    expect(o.parameters).toEqual([]);
  });

  it('a set parameter drops its range so the policy value is not redrawn', () => {
    const p: Provision = { ...budgetProvision, role: 'control', mapping: { kind: 'parameter', target: 'suitable_openings', op: 'set', value: 2000, unit: 'people', evidence: { label: 'x', kind: 'assumed' } } };
    const draft = draftFor(training, [p]);
    const r = pairedRun(training, [], draft, { runs: 20, seed: 3 });
    expect(r.ok).toBe(true);
    const run = runModel(training, { overlays: [draftToOverlay(draft, training)], seed: 3, run: 5 });
    expect(run.parameters._.suitable_openings).toBe(2000);
  });

  it('never rewrites an equation: effects attach to hooks', () => {
    const e: Provision = { ...budgetProvision, role: 'coefficient', mapping: { kind: 'effect', target: 'placements', op: 'add', expr: '100', unit: 'people', from: 2028, evidence: { label: 'assumed', kind: 'assumed' } } };
    const o = draftToOverlay(draftFor(training, [e]), training);
    expect(o.variables).toBeUndefined();
    expect(o.effects![0]).toMatchObject({ target: 'placements', op: 'add', expr: '100', from: 2028 });
    const base = runModel(training);
    const pol = runModel(training, { overlays: [o] });
    expect(pol.series._.placements.map((v, t) => v - base.series._.placements[t])).toEqual([0, 0, 100, 100]);
  });
});

describe('pairedRun', () => {
  it('a draft with nothing mapped gives zero paired difference in every draw', () => {
    const d = draftFor(training, [stipendProvision, reportProvision]);
    const r = pairedRun(training, [], d, { runs: 50, seed: 7 });
    expect(r.ok).toBe(true);
    for (const o of r.outputs) for (const q of ['p5', 'p50', 'p95', 'mean'] as const) expect(r.difference._[o][q].every((x) => x === 0)).toBe(true);
  });

  it('differences are taken per draw, not as a difference of quantiles', () => {
    const r = pairedRun(training, [], threeStatusDraft(), { runs: 200, seed: 1 });
    expect(r.ok).toBe(true);
    // 2029: budget 12M vs 20M. Baseline completions = min(4000, capacity); policy = min(2400, capacity).
    const t = 3;
    const perDraw: number[] = [];
    for (let run = 0; run < 200; run++) {
      const b = runModel(training, { seed: 1, run });
      const p = runModel(training, { seed: 1, run, overlays: [draftToOverlay(threeStatusDraft(), training)] });
      perDraw.push(p.series._.completions[t] - b.series._.completions[t]);
    }
    perDraw.sort((a, b) => a - b);
    expect(r.difference._.completions.p50[t]).toBeCloseTo((perDraw[99] + perDraw[100]) / 2, 9);
    const naive = r.policy._.completions.p5[t] - r.baseline._.completions.p5[t];
    expect(r.difference._.completions.p5[t]).not.toBeCloseTo(naive, 3);
    // the paired difference can never be positive here: less money never buys more completions
    expect(r.difference._.completions.p95[t]).toBeLessThanOrEqual(0);
  });

  it('is deterministic for a seed and records a manifest', () => {
    const now = () => '2026-09-13T00:00:00.000Z';
    const a = pairedRun(training, [], threeStatusDraft(), { runs: 30, seed: 11, now });
    const b = pairedRun(training, [], threeStatusDraft(), { runs: 30, seed: 11, now });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.manifest).toMatchObject({ schema: 'policy-run/2', modelId: 'training-budget', modelHash: modelHash(training), engineVersion: ENGINE_VERSION, runs: 30, seed: 11, draws: { count: 30, seed: 11, firstIndex: 0 }, draftId: 'test-draft', reviewStatus: 'author-drafted' });
    expect(a.manifest.evidence).toEqual([{ provisionId: 'fund', role: 'funding', target: 'input:training_budget', kind: 'assumed', label: 'Test Act sec. 1(a)', url: 'https://example.gov/test-act' }]);
    expect(a.manifest.coverage).toMatchObject({ allHaveStatus: true, statusText: 'every listed provision has a status', completeness: 'completeness not attested' });
    expect(a.manifest.coverage.source).toMatchObject({ status: 'source-unavailable', text: 'source unavailable — coverage unknown' });
    const withText = pairedRun(training, [], threeStatusDraft(), { runs: 2, seed: 11, now, sourceText: SOURCE_TEXT });
    expect(withText.manifest.coverage.source).toMatchObject({ status: 'complete', clauses: 3, covered: 3, uncovered: 0 });
  });

  it('names what binds on each side', () => {
    const r = pairedRun(training, [], threeStatusDraft(), { runs: 5 });
    // 2026: policy budget is 0, so the budget binds completions; baseline also budget-bound at $6M
    expect(r.binding.policy._[0]).toContain('completions is limited by training_budget / cost_per_completion');
    expect(r.binding.baseline._[3]).toContain('completions is limited by instructor_capacity');
  });

  it('reports a draft that cannot run instead of numbers', () => {
    const e: Provision = { ...budgetProvision, role: 'coefficient', mapping: { kind: 'effect', target: 'placements', op: 'add', expr: 'ghost', unit: 'people', evidence: { label: 'x', kind: 'assumed' } } };
    const r = pairedRun(training, [], draftFor(training, [e]), { runs: 5 });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('unknown-target');
    expect(r.errors.join(' ')).toContain('ghost');
  });

  it('works on a monthly model with scenario overlays on both sides', () => {
    const p: Provision = {
      id: 'ramp',
      quote: 'Each participant shall receive a stipend.',
      summary: '',
      status: 'mapped',
      role: 'control',
      mapping: { kind: 'input', target: 'retrainingParticipation', op: 'set', curve: { '2026': 0, '2027': 60 }, unit: 'percent', evidence: { label: 'x', kind: 'assumed' } },
    };
    const r = pairedRun(cohort, [retraining], draftFor(cohort, [p]), { runs: 3 });
    expect(r.ok).toBe(true);
    expect(r.years).toHaveLength(61);
    expect(r.outputs).toContain('retraining_cost');
    expect(r.manifest.baselineOverlays.map((o) => o.id)).toEqual(['retraining']);
    const last = r.years.length - 1;
    expect(r.difference._.displaced_pool.p50[last]).toBeLessThan(0);
  });
});

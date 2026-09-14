/**
 * data/core/korinek-2026-faithful.json — independent numerical checks of the faithful port of
 * Korinek, Jones, Sacher, Cotter & McCrory (2026), Anthropic Institute WP 2026-02.
 *
 * Four kinds of check, none of which reads the model's own in-file tests:
 *
 *   1. Published tables: Table 3 (all rows, all three scenarios, plus the no-AI column as a
 *      limiting case), Table 5 (capital-supply elasticity, 8 columns), Table 6 (wage rigidity,
 *      7 columns), footnote 14 and numbers quoted in the text. Tolerance: the half-width of the
 *      printed digit plus 5-10 percent of it.
 *   2. Accounting identities that must hold every month.
 *   3. Limiting cases with known answers (no AI, a pegged rental rate, flexible and fully rigid
 *      wages, no automation, small shocks against the paper's first-order formulas).
 *   4. Monthly paths against data/core/korinek-2026-faithful.expected.json: numbers produced by
 *      running the authors' explorer model code headless as an oracle (provenance in that file;
 *      no explorer code is in this repository), at the three presets and eight non-default
 *      settings. This verifies transcription against the authors' implementation; the published
 *      tables in (1) are what pin the model down independently of it.
 */
import { describe, expect, it } from 'vitest';

import model from '../../data/core/korinek-2026-faithful.json';
import expectedPaths from '../../data/core/korinek-2026-faithful.expected.json';
import extremeOverlay from '../../data/core/overlays/korinek-faithful-extreme.json';
import modestOverlay from '../../data/core/overlays/korinek-faithful-modest.json';
import { runModel } from './engine';
import { CORE_FIXTURES } from './fixtures';
import type { CoreModel, Overlay, RunResult } from './types';

const base = model as unknown as CoreModel;
const modest = modestOverlay as unknown as Overlay;
const extreme = extremeOverlay as unknown as Overlay;

type Scenario = 'modest' | 'substantial' | 'extreme';
const SCENARIO_OVERLAYS: Record<Scenario, Overlay[]> = { modest: [modest], substantial: [], extreme: [extreme] };

/** A sensitivity setting as an overlay that only changes parameter values. */
function setting(values: Record<string, number>): Overlay {
  return { id: `setting-${Object.entries(values).map(([k, v]) => `${k}=${v}`).join(',')}`, parameters: Object.entries(values).map(([id, value]) => ({ id, value })) };
}

function run(overlays: Overlay[] = []): RunResult {
  const r = runModel(base, { overlays });
  expect(r.ok, r.diagnostics.filter((d) => d.level === 'error').map((d) => `${d.code}: ${d.message}`).join('; ')).toBe(true);
  return r;
}

const step = (r: RunResult, year: number) => {
  const t = r.years.findIndex((y) => Math.abs(y - year) < 1e-9);
  expect(t, `year ${year} is a step`).toBeGreaterThanOrEqual(0);
  return t;
};
const at = (r: RunResult, id: string, year: number) => r.series._[id][step(r, year)];
const path = (r: RunResult, id: string) => r.series._[id];

/** Tolerance for a number printed with `decimals` decimals: half the last digit plus 10 percent. */
const printed = (decimals: number) => 0.55 * 10 ** -decimals;

// ---------------------------------------------------------------------------
// Published numbers, transcribed from the paper (pages cited)
// ---------------------------------------------------------------------------

/** Table 3 (p.31). [variable, decimals printed, No AI, Modest, Substantial, Extreme]. */
const TABLE3: Array<[string, number, number, number, number, number]> = [
  ['gdpGapPct', 1, 0, 1.6, 8.3, 32.4],
  ['gdpIndex', 1, 112.7, 114.5, 122.1, 149.3],
  ['gdpGrowthPct', 1, 2.0, 2.4, 5.4, 15.4],
  ['avgWagePct', 1, 0, 0.7, 2.1, 9.7],
  ['cogWagePct', 1, 0, 0.4, -0.3, -11.5],
  ['otherWagePct', 1, 0, 1.1, 5.9, 33.6],
  ['netReturnPct', 1, 6.5, 6.6, 7.0, 8.3],
  ['capitalPct', 1, 0, 2.3, 13.8, 56.3],
  ['laborSharePct', 1, 60.0, 59.4, 56.1, 45.2],
  ['capitalSharePct', 1, 40.0, 40.6, 43.9, 54.8],
  ['laborIncomePct', 1, 0, 0.6, 1.4, 0.5],
  ['cogWageBillPct', 1, 0, -0.3, -4.6, -31.0],
  ['capitalIncomePct', 1, 0, 3.1, 18.9, 81.4],
  ['cogEmpSinceMid2026Pct', 1, 0, -0.5, -3.9, -21.5],
  ['uCogPct', 1, 2.9, 2.9, 4.5, 17.9],
  ['uAllPct', 1, 3.8, 3.9, 4.6, 11.9],
  ['tfpPct', 1, 0, 0.7, 3.1, 13.4],
  ['tfpGrowthPct', 1, 1.0, 1.2, 2.3, 7.3],
  ['ideasPct', 2, 0, 0.07, 0.2, 0.61],
  ['ideasGrowthPct', 2, 1.67, 1.69, 1.76, 2.02],
];

/** Table 5 (p.37), epsilon in {1, 3, 6, infinity}, Substantial then Extreme. */
const TABLE5_EPS = [1, 3, 6, Infinity];
const TABLE5: Record<string, { substantial: number[]; extreme: number[] }> = {
  gdpGapPct: { substantial: [6.4, 8.3, 9.1, 10.0], extreme: [21.3, 32.4, 37.2, 43.3] },
  avgWagePct: { substantial: [-1.6, 2.1, 3.7, 5.6], extreme: [-9.2, 9.7, 18.3, 30.1] },
  netReturnPct: { substantial: [7.6, 7.0, 6.8, 6.5], extreme: [10.3, 8.3, 7.5, 6.5] },
  capitalPct: { substantial: [9.3, 13.8, 15.7, 18.2], extreme: [33.5, 56.3, 67.1, 82.2] },
  laborSharePct: { substantial: [55.1, 56.1, 56.5, 57.0], extreme: [41.2, 45.2, 46.9, 49.1] },
};

/** Table 6 (p.38): Substantial at xi in {0.5, 0.75, 0.9}, Extreme at xi in {0, 0.5, 0.75, 0.9}. */
const TABLE6_XI = { substantial: [0.5, 0.75, 0.9], extreme: [0, 0.5, 0.75, 0.9] };
const TABLE6: Record<string, { substantial: number[]; extreme: number[] }> = {
  gdpGapPct: { substantial: [8.3, 7.9, 7.7], extreme: [36.6, 32.4, 30.5, 29.2] },
  avgWagePct: { substantial: [2.1, 2.2, 2.3], extreme: [1.6, 9.7, 11.1, 11.9] },
  cogWagePct: { substantial: [-0.3, 0.7, 1.4], extreme: [-42.2, -11.5, -2.9, 2.8] },
  otherWagePct: { substantial: [5.9, 4.5, 3.7], extreme: [70.1, 33.6, 25.8, 21.1] },
  cogEmpSinceMid2026Pct: { substantial: [-3.9, -4.6, -5.0], extreme: [-1.3, -21.5, -25.9, -28.5] },
  uCogPct: { substantial: [4.5, 5.1, 5.4], extreme: [2.6, 17.9, 21.7, 24.0] },
  uAllPct: { substantial: [4.6, 4.9, 5.2], extreme: [3.1, 11.9, 13.9, 15.2] },
};

/** No AI: both paths ~0 (logistics through a vanishing anchor), normal-times search discount. */
const NO_AI = setting({ mMid2026: 1e-9, m2030: 2e-9, dMid2026: 1e-9, d2030: 2e-9, mu: 0.17 });

function expectPublished(where: string, actual: number, published: number, tol: number) {
  const err = Math.abs(actual - published);
  expect(err, `${where}: model ${actual.toFixed(4)} vs published ${published} (tol ${tol})`).toBeLessThanOrEqual(tol);
}

describe('korinek-2026-faithful: registration', () => {
  it('is registered with its scenario and sensitivity overlays, beside the reduced-form file', () => {
    const entry = CORE_FIXTURES.find((f) => f.model.id === 'korinek-2026-faithful');
    expect(entry).toBeDefined();
    expect(entry!.label).toMatch(/faithful port \(paper equations\)/);
    expect(entry!.overlays.map((o) => o.id).sort()).toEqual([
      'korinek-faithful-extreme', 'korinek-faithful-modest', 'korinek-faithful-pegged-rental', 'korinek-faithful-rigid-wage',
    ]);
    expect(CORE_FIXTURES.some((f) => f.model.id === 'korinek-2026')).toBe(true);
  });

  it('runs monthly from 2024.0 to 2030.0 (73 steps, the date convention of Section 2.1.2)', () => {
    const r = run();
    expect(r.years.length).toBe(73);
    expect(r.years[0]).toBe(2024);
    expect(r.years[72]).toBe(2030);
  });
});

describe('published tables', () => {
  describe('Table 3 (p.31): the three scenarios at the start of 2030', () => {
    const runs = { modest: run(SCENARIO_OVERLAYS.modest), substantial: run(), extreme: run(SCENARIO_OVERLAYS.extreme) };
    TABLE3.forEach(([id, dec, , ...cols]) => {
      (['modest', 'substantial', 'extreme'] as Scenario[]).forEach((s, i) => {
        it(`${s}: ${id} = ${cols[i]}`, () => expectPublished(`Table 3 ${s} ${id}`, at(runs[s], id, 2030), cols[i], printed(dec)));
      });
    });
  });

  describe('Table 3 (p.31): the no-AI column as a limiting case', () => {
    const r = run([NO_AI]);
    TABLE3.forEach(([id, dec, noAI]) => {
      // cogEmpSinceMid2026Pct is 0 by construction; every other row is a real check.
      it(`no AI: ${id} = ${noAI}`, () => expectPublished(`Table 3 no-AI ${id}`, at(r, id, 2030), noAI, printed(dec)));
    });
  });

  describe('Table 5 (p.37): four elasticities of capital supply', () => {
    (['substantial', 'extreme'] as const).forEach((s) => {
      TABLE5_EPS.forEach((eps, j) => {
        it(`${s}, epsilon = ${eps}`, () => {
          const r = run([...SCENARIO_OVERLAYS[s], setting({ invEps: eps === Infinity ? 0 : 1 / eps })]);
          for (const [id, cols] of Object.entries(TABLE5)) expectPublished(`Table 5 ${s} eps=${eps} ${id}`, at(r, id, 2030), cols[s][j], printed(1));
        });
      });
    });
  });

  describe('Table 6 (p.38): four rigidities of the cognitive wage', () => {
    (['substantial', 'extreme'] as const).forEach((s) => {
      TABLE6_XI[s].forEach((xi, j) => {
        it(`${s}, xi = ${xi}`, () => {
          const r = run([...SCENARIO_OVERLAYS[s], setting({ xi })]);
          for (const [id, cols] of Object.entries(TABLE6)) expectPublished(`Table 6 ${s} xi=${xi} ${id}`, at(r, id, 2030), cols[s][j], printed(1));
        });
      });
    });
  });

  it("Table 1's rounded calibration does not reproduce every printed digit; the unrounded one does (why wC, Ubar, qTshare and the hazards are unrounded)", () => {
    const rounded = run([setting({ wC: 0.624, Ubar: 0.038, qTshare: 0.55, sepHazardC: 0.69, sepHazardN: 1.52 })]);
    // Substantial all-worker unemployment: published 4.6; rounded inputs give 4.53 (prints 4.5).
    expect(Math.abs(at(rounded, 'uAllPct', 2030) - 4.6)).toBeGreaterThan(printed(1));
    expectPublished('unrounded u_all', at(run(), 'uAllPct', 2030), 4.6, printed(1));
  });

  it('footnote 14 (p.37): GDP +7.2 percent and labour income lower by 4.3 percent of no-AI GDP', () => {
    const r = run([setting({ psi: 0.9, mu: 0.04, rho: 0, invEps: 1 })]);
    expectPublished('fn14 GDP', at(r, 'gdpGapPct', 2030), 7.2, printed(1));
    // Labour income in percent of no-AI GDP = s_L,t0 x the labour-income gap.
    expectPublished('fn14 labour income, pct of GDP', at(r, 'sL', 2030) * at(r, 'laborIncomePct', 2030), -4.3, printed(1));
  });

  it('text, Section 2.1.3 (pp.12-13): Substantial 2030 rental rate 4.6 percent above r-bar, wage 1.9 percent, exact level TFP 0.029', () => {
    const r = run();
    expectPublished('rental', 100 * Math.expm1(at(r, 'xPot', 2030)), 4.6, printed(1));
    expectPublished('wage', 100 * Math.expm1(at(r, 'lnWPot', 2030)), 1.9, printed(1));
    const md = at(r, 'md', 2030);
    const levelTfp = -Math.log(0.4 + 0.6 * (1 - md * (1 - at(r, 'costFactor', 2030)))) / 0.5;
    expectPublished('level TFP', levelTfp, 0.029, printed(3));
  });

  it('text, Sections 2.2 and 4.2-4.3: Extreme uplift 0.28, ideas stock +0.6 percent headed for +10 percent, GDP 40 percent above mid-2026; Substantial N employment +4.6 percent since mid-2026', () => {
    const e = run(SCENARIO_OVERLAYS.extreme);
    expectPublished('Delta ln R', at(e, 'lnResearchGap', 2030), 0.28, printed(2));
    expectPublished('ideas', at(e, 'ideasPct', 2030), 0.6, printed(1));
    expectPublished('long-run ideas, gamma Delta ln R', 100 * at(e, 'lnResearchGap', 2030) * at(e, 'lambda', 2030) / at(e, 'oneMinusPhiR', 2030), 10, printed(0));
    const growth = at(e, 'g', 2030) + at(e, 'n', 2030);
    expectPublished('GDP vs mid-2026', 100 * Math.expm1(at(e, 'lnGDPGap', 2030) - at(e, 'lnGDPGap', 2026.5) + 3.5 * growth), 40, printed(0));
    const s = run();
    expectPublished('N employment since mid-2026', 100 * (at(s, 'ellN', 2030) / at(s, 'ellN', 2026.5) - 1), 4.6, printed(1));
  });

  it('text, Section 4.3: a transfer of about 9 percent of GDP would hold Extreme cognitive income at its no-AI level', () => {
    const e = run(SCENARIO_OVERLAYS.extreme);
    const sC = at(e, 'sL', 2030) * at(e, 'wC', 2030);
    const transferPctGdp = (sC * -at(e, 'cogWageBillPct', 2030)) / Math.exp(at(e, 'lnGDPGap', 2030));
    expectPublished('transfer', transferPctGdp, 9, printed(0));
  });

  it('text, Section 2.3.2 (p.21): steady-state unemployment 2.9 percent of C and 5.4 percent of N; one job-finder in seven changes group', () => {
    const r = run();
    const v = (id: string) => at(r, id, 2024);
    expectPublished('u_C', (100 * v('UBarC')) / (v('ellC0') + v('UBarC')), 2.9, printed(1));
    expectPublished('u_N', (100 * v('UBarN')) / (v('ellN0') + v('UBarN')), 5.4, printed(1));
    // Destination shares at mu-bar: a C-origin finder lands in N with mu-bar (H_N/S_N) / f-bar_C, and conversely.
    const switchers = v('HBarC') * v('muBar') * v('hirePerSearchN') / v('fBarC') + v('HBarN') * v('muBar') * v('hirePerSearchC') / v('fBarN');
    expectPublished('switching share', switchers / (v('HBarC') + v('HBarN')), 1 / 7, 0.005);
  });

  it('Appendix A (p.41): on the Extreme path the monthly ideas recursion is within 0.02 pp of the closed form (43) in 2030', () => {
    const e = run(SCENARIO_OVERLAYS.extreme);
    const g = at(e, 'g', 2030);
    const k = at(e, 'oneMinusPhiR', 2030);
    const lambda = at(e, 'lambda', 2030);
    const gap = path(e, 'lnGDPGap');
    // Eq (43) with the integral over the realised monthly GDP gap by the trapezoid rule.
    let integral = 0;
    for (let i = 1; i < e.years.length; i++) {
      const f = (j: number) => Math.exp(-k * g * (2030 - e.years[j]) + lambda * gap[j]);
      integral += ((f(i) + f(i - 1)) / 2) * (1 / 12);
    }
    const closed = Math.log(Math.exp(-k * g * 6) + k * g * integral) / k;
    expect(Math.abs(100 * closed - 100 * at(e, 'dlnA', 2030))).toBeLessThan(0.02);
  });
});

describe('accounting identities, every month', () => {
  const cases: Array<[string, Overlay[]]> = [
    ['modest', SCENARIO_OVERLAYS.modest],
    ['substantial', []],
    ['extreme', SCENARIO_OVERLAYS.extreme],
    ['extreme, epsilon = 1, xi = 0.9', [extreme, setting({ invEps: 1, xi: 0.9 })]],
  ];
  for (const [name, overlays] of cases) {
    it(`${name}: workers add up to the labour force; hires identity; matching bounds; shares; wage and capital rows`, () => {
      const r = run(overlays);
      const s = r.series._;
      for (let t = 0; t < r.years.length; t++) {
        expect(Math.abs(s.ellC[t] + s.ellN[t] + s.UC[t] + s.UN[t] - 1), `adding up at ${r.years[t]}`).toBeLessThan(1e-12);
        expect(Math.abs(s.fC[t] * s.UC[t] + s.fN[t] * s.UN[t] - s.hiresC[t] - s.hiresN[t]), 'sum f U = sum H (p.20)').toBeLessThan(1e-14);
        expect(s.hiresC[t]).toBeLessThanOrEqual(s.chi[t] * Math.min(s.searchC[t], s.openingsC[t]) + 1e-15);
        expect(s.hiresN[t]).toBeLessThanOrEqual(s.chi[t] * Math.min(s.searchN[t], s.openingsN[t]) + 1e-15);
        expect(s.fC[t]).toBeLessThanOrEqual(1);
        expect(s.fN[t]).toBeLessThanOrEqual(1);
        expect(Math.abs(s.laborSharePct[t] + s.capitalSharePct[t] - 100)).toBeLessThan(1e-12);
        expect(Math.abs(s.lnWPot[t] - s.lnYLPot[t] - s.lnSLPot[t]), 'eq (5)').toBeLessThan(1e-13);
        expect(Math.abs(s.xPot[t] - s.invEps[t] * s.lnKPot[t]), 'eq (18)').toBeLessThan(1e-10);
        expect(Math.abs(s.xAct[t] - s.invEps[t] * s.lnK[t]), 'eq (39) capital row').toBeLessThan(1e-10);
        // Income shares: s_L = (w_C ell_C + w_N ell_N) / Y in base-period units, at realised employment.
        const labourIncomeShare = (s.sL[t] * (Math.exp(s.lnMPLC[t]) * s.ellC[t] / s.ellC0[t] * s.wC[t] + Math.exp(s.lnWN[t]) * s.ellN[t] / s.ellN0[t] * (1 - s.wC[t]))) / Math.exp(s.lnGDPGap[t]);
        expect(Math.abs(labourIncomeShare - s.laborShare[t]), 'marginal-product income shares sum to 1 - k').toBeLessThan(1e-9);
        expect(s.overhangN[t], 'G_N = 0 on the scenario paths (Table A.1 notes)').toBe(0);
        // B_C enters no equation; the paper calls it negligible on its three scenario paths (at most 0.0011 here).
        if (overlays.length <= 1) expect(s.shortfallC[t], 'B_C negligible on the scenario paths (Table A.1 notes)').toBeLessThan(2e-3);
      }
    });
  }

  it('the actual economy (39) evaluated at the targets is Proposition 1 (Table A.1 note)', () => {
    const atTargets: Overlay = {
      id: 'check-actual-at-targets',
      variables: [
        { id: 'tgtShiftC', equation: '(log(Lam / wC) - log(tgtC / ellC0)) / sigma' },
        { id: 'tgtShiftN', equation: '-log(tgtN / ellN0) / sigma' },
        { id: 'tgtX', equation: 'sL * Lam * exp((1 - sigma) * (tgtShiftC - dlnA)) + sN0 * exp((1 - sigma) * (tgtShiftN - dlnA))' },
        { id: 'tgtU', equation: 'sigma / (1 - sigma) * log((1 - kTgt) / tgtX)' },
        { id: 'tgtLnY', equation: 'tgtU + (1 - sigma) * dlnA' },
        { id: 'tgtLnWC', equation: 'tgtU / sigma + tgtShiftC' },
        { id: 'tgtLnWN', equation: 'tgtU / sigma + tgtShiftN' },
      ],
      solves: [{ id: 'check-at-targets', unknown: 'kTgt', residual: 'log(kTgt / Bt) / (1 - sigma) - invEps * (log(kTgt / sK) + sigma / (1 - sigma) * log((1 - kTgt) / tgtX) + (1 - sigma) * dlnA - log(kTgt / Bt) / (1 - sigma))', bracket: [1e-12, 1 - 1e-12], tol: 1e-14, maxIter: 200 }],
      outputs: ['tgtLnY', 'tgtLnWC', 'tgtLnWN'],
    };
    for (const overlays of [[atTargets], [extreme, atTargets]]) {
      const s = run(overlays).series._;
      for (let t = 0; t < s.kPot.length; t++) {
        // With L-bar = L - U-bar the output per worker of Proposition 1 is output per member of the base employment.
        expect(Math.abs(s.tgtLnY[t] - s.lnYLPot[t])).toBeLessThan(1e-10);
        expect(Math.abs(s.kTgt[t] - s.kPot[t])).toBeLessThan(1e-10);
        expect(Math.abs(s.tgtLnWC[t] - s.lnWPot[t])).toBeLessThan(1e-10);
        expect(Math.abs(s.tgtLnWN[t] - s.lnWPot[t])).toBeLessThan(1e-10);
      }
    }
  });
});

describe('limiting cases', () => {
  it('no AI: every gap stays at zero and unemployment stays at its normal level', () => {
    const s = run([NO_AI]).series._;
    for (let t = 0; t < s.kPot.length; t++) {
      for (const id of ['gdpGapPct', 'avgWagePct', 'cogWagePct', 'otherWagePct', 'capitalPct', 'tfpPct', 'ideasPct']) expect(Math.abs(s[id][t]), `${id} at step ${t}`).toBeLessThan(1e-5);
      expect(Math.abs(s.UC[t] + s.UN[t] - s.Ubar[t])).toBeLessThan(1e-9);
      expect(Math.abs(s.ellC[t] - s.ellC0[t])).toBeLessThan(1e-9);
      expect(s.layoffsC[t]).toBe(0);
    }
  });

  it('infinitely elastic capital (epsilon = infinity): the rental rate never moves, and the wage is the level channel plus the ideas stock', () => {
    for (const overlays of [[setting({ invEps: 0 })], [extreme, setting({ invEps: 0 })]]) {
      const s = run(overlays).series._;
      for (let t = 0; t < s.kPot.length; t++) {
        expect(Math.abs(s.xPot[t])).toBeLessThan(1e-13);
        expect(Math.abs(s.xAct[t])).toBeLessThan(1e-13);
        expect(s.netReturnPct[t]).toBeCloseTo(6.5, 12);
        const levelChannel = (Math.log((1 - s.Bt[t]) / s.sL[t]) + s.lNtilde[t]) / (1 - s.sigma[t]);
        expect(Math.abs(s.lnWPot[t] - s.dlnA[t] - levelChannel)).toBeLessThan(1e-12);
      }
    }
  });

  it('flexible cognitive wage (xi = 0): the wage clears every month and nobody is laid off (Table 6, Extreme xi = 0)', () => {
    const s = run([extreme, setting({ xi: 0 })]).series._;
    for (let t = 0; t < s.kPot.length; t++) {
      expect(s.layoffsC[t]).toBe(0);
      expect(Math.abs(s.lnWC[t] - s.lnWCClear[t])).toBeLessThan(1e-12);
    }
    // ... while at the paper's xi = 0.5 the Extreme path does lay workers off.
    expect(Math.max(...path(run(SCENARIO_OVERLAYS.extreme), 'layoffsC'))).toBeGreaterThan(1e-3);
  });

  it('fully rigid cognitive wage (xi = 1): the cognitive wage is the common wage throughout (eq 30)', () => {
    const s = run([extreme, setting({ xi: 1 })]).series._;
    for (let t = 0; t < s.kPot.length; t++) expect(s.lnWC[t]).toBe(s.lnWPot[t]);
  });

  it('no automation (psi = 0): B_t = s_K and the labour share is 1 - s_K e^{(1-sigma) Delta ln r} (eq 14)', () => {
    const s = run([setting({ psi: 0 })]).series._;
    for (let t = 0; t < s.kPot.length; t++) {
      expect(s.Bt[t]).toBe(s.sK[t]);
      expect(Math.abs(s.sLPot[t] - (1 - s.sK[t] * Math.exp((1 - s.sigma[t]) * s.xPot[t])))).toBeLessThan(1e-12);
    }
  });

  it('small shocks: the exact rows converge to the first-order rows (19) and (11)', () => {
    const ratios = (scale: number) => {
      const r = run([setting({ mMid2026: 0.14 * scale, m2030: 0.3 * scale, dMid2026: 0.1, d2030: 0.4, aMid2026: 0.35 * scale, ga: 0 })]);
      const v = (id: string) => at(r, id, 2030);
      const md = v('md');
      const a = v('a');
      const [rho, psi, sigma, sL, sK] = [v('rho'), v('psi'), v('sigma'), v('sL'), v('sK')];
      const lNFirst = (1 - rho) * psi * md + (1 - sigma) * (1 - psi) * md * a;
      const xFirst = (md * a + ((1 - rho - (1 - sigma) * a) * psi * md) / sK + v('dlnA')) / (1 / v('invEps') + sigma / sL);
      return { lN: v('lNtilde') / lNFirst - 1, x: v('xPot') / xFirst - 1 };
    };
    const big = ratios(1e-2);
    const small = ratios(1e-4);
    expect(Math.abs(small.lN)).toBeLessThan(1e-3);
    expect(Math.abs(small.x)).toBeLessThan(1e-3);
    expect(Math.abs(small.lN)).toBeLessThan(Math.abs(big.lN));
    expect(Math.abs(small.x)).toBeLessThan(Math.abs(big.x));
  });

  it('faster posting (theta^H = 1 vs 0.1) lowers peak unemployment', () => {
    const peak = (thetaH: number) => Math.max(...path(run([setting({ thetaH })]), 'uAllPct'));
    expect(peak(1)).toBeLessThan(peak(0.1));
  });
});

describe('monthly paths against the authors\' explorer run as an oracle (korinek-2026-faithful.expected.json)', () => {
  const file = expectedPaths as unknown as {
    provenance: { kernelUrl: string; kernelSha256: string; fetched: string };
    settings: Array<{ id: string; modelParameters: Record<string, number>; years: number[]; series: Record<string, number[]> }>;
  };

  it('records its provenance', () => {
    expect(file.provenance.kernelUrl).toBe('https://www.anthropic.com/_next/static/chunks/2bnydcp8p6u_h.js');
    expect(file.provenance.kernelSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(file.provenance.fetched).toBe('2026-09-13');
    const nonDefault = file.settings.filter((s) => !['modest', 'substantial', 'extreme'].includes(s.id));
    expect(nonDefault.length).toBeGreaterThanOrEqual(2);
  });

  for (const s of file.settings) {
    it(`${s.id}: every stored series at every stored date (2024.0-2030.0, quarterly)`, () => {
      const r = run([setting(s.modelParameters)]);
      let checked = 0;
      for (const [id, expected] of Object.entries(s.series)) {
        const tol = id.endsWith('Pct') ? 1e-8 : 1e-10;
        s.years.forEach((year, i) => {
          const actual = at(r, id, year);
          expect(Math.abs(actual - expected[i]), `${s.id} ${id} at ${year}: ${actual} vs ${expected[i]}`).toBeLessThanOrEqual(tol);
          checked++;
        });
      }
      expect(checked).toBeGreaterThan(500);
    });
  }
});

describe('performance', () => {
  it('a full 73-month run takes well under a second', () => {
    run();
    const t0 = performance.now();
    run();
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});

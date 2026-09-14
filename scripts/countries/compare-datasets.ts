#!/usr/bin/env tsx
/**
 * Before/after tables for the country-data migration (docs/design/research/country-data-migration.md).
 *
 * Runs the same scenarios on `countries-legacy-v1` and `countries-wb-2026-09` in one process
 * (the dataset is chosen per run, not through COUNTRY_DATASET) and prints markdown:
 * field coverage, archetype changes, base paths of the default and legacy presets, the
 * anchored model's stress table, the 10 countries whose 10-year wellbeing moves most, and the
 * margin by which the US keeps the archetype its Korinek calibration attaches through.
 *
 * Reporting only; exit 0. Usage: npx tsx scripts/countries/compare-datasets.ts
 */

import {
  INITIAL_CORPORATIONS,
  COGNITIVE_SHARE_BY_ARCHETYPE,
  LEGACY_COUNTRY_DATASET_ID,
  PRESET_MODELS,
  WB_COUNTRY_DATASET_ID,
  countriesForDataset,
  countryDatasetFile,
  type CountryDatasetId,
} from '../../constants';
import { advanceRun, initOptionsFor, initialRun, type SimulationRun } from '../../simulation/run';
import { POOR_COUNTRY_IDS, MACRO_STRESS_SWITCH, type Scenario } from '../../validation/responseProfile';
import type { ModelParameters } from '../../types';

const DATASETS: CountryDatasetId[] = [LEGACY_COUNTRY_DATASET_ID, WB_COUNTRY_DATASET_ID];
const SHORT: Record<CountryDatasetId, string> = { [LEGACY_COUNTRY_DATASET_ID]: 'legacy-v1', [WB_COUNTRY_DATASET_ID]: 'wb-2026-09' };
const f1 = (x: number) => x.toFixed(1);
const f3 = (x: number) => x.toFixed(3);
const sgn = (x: number, d = 1) => (x >= 0 ? '+' : '') + x.toFixed(d);
const L: string[] = [];

function run(model: ModelParameters, dataset: CountryDatasetId, months: number, corporations = INITIAL_CORPORATIONS, every?: (r: SimulationRun) => void): SimulationRun[] {
  let r = initialRun(corporations.map((c) => ({ ...c })), undefined, initOptionsFor(model, dataset));
  const out = [r];
  for (let m = 1; m <= months; m++) {
    r = advanceRun(r, { model });
    every?.(r);
    out.push(r);
  }
  return out;
}

const poor = (r: SimulationRun) => {
  const cs = POOR_COUNTRY_IDS.map((id) => r.state.countryData[id]).filter(Boolean);
  return cs.reduce((a, c) => a + c.wellbeing, 0) / cs.length;
};

// ---- coverage ---------------------------------------------------------------------------------
const wb = countryDatasetFile(WB_COUNTRY_DATASET_ID);
L.push('## Coverage of countries-wb-2026-09', '', '| field | observed | legacy-unsourced | missing | legacy-unsourced ids | observation years |', '|---|---|---|---|---|---|');
for (const f of ['population', 'gdpPerCapita', 'gini', 'governance'] as const) {
  const obs = wb.countries.filter((c) => c[f].status === 'observed');
  const leg = wb.countries.filter((c) => c[f].status === 'legacy-unsourced');
  const miss = wb.countries.filter((c) => c[f].status === 'missing');
  const years: Record<number, number> = {};
  obs.forEach((c) => { years[c[f].year!] = (years[c[f].year!] ?? 0) + 1; });
  const yearText = Object.entries(years).sort((a, b) => Number(b[0]) - Number(a[0])).map(([y, n]) => `${y}: ${n}`).join(', ');
  L.push(`| ${f} | ${obs.length} | ${leg.length} | ${miss.length} | ${leg.map((c) => c.id).join(', ') || '—'} | ${yearText} |`);
}

// ---- archetypes -------------------------------------------------------------------------------
const before = new Map(countriesForDataset(LEGACY_COUNTRY_DATASET_ID).map((c) => [c.id, c] as const));
const after = countriesForDataset(WB_COUNTRY_DATASET_ID);
const moved = after.filter((c) => before.get(c.id)!.archetype !== c.archetype);
L.push('', `## Archetype changes (${moved.length} of ${after.length}; same rule, new inputs)`, '', '| id | before | after | GDP pc before → after | governance before → after |', '|---|---|---|---|---|');
for (const c of moved) {
  const b = before.get(c.id)!;
  L.push(`| ${c.id} | ${b.archetype} | ${c.archetype} | ${b.gdpPerCapita.toFixed(0)} → ${c.gdpPerCapita.toFixed(0)} | ${b.governance.toFixed(2)} → ${c.governance.toFixed(3)} |`);
}
const counts = (list: { archetype: string }[]) => {
  const o: Record<string, number> = {};
  list.forEach((c) => { o[c.archetype] = (o[c.archetype] ?? 0) + 1; });
  return Object.entries(o).sort().map(([k, v]) => `${k} ${v}`).join(', ');
};
L.push('', `Counts before: ${counts([...before.values()])}. After: ${counts(after)}.`);

// ---- base paths -------------------------------------------------------------------------------
const anchored = PRESET_MODELS.find((m) => m.id === 'evidence-anchored')!;
const legacyPreset = PRESET_MODELS[0];
L.push('', '## Base paths', '', '| preset | dataset | month | avg wellbeing | US wellbeing | poor-8 wellbeing | US adoption | countries in crisis | inflow bn/mo |', '|---|---|---|---|---|---|---|---|---|');
const finals: Record<string, Record<CountryDatasetId, SimulationRun>> = {};
for (const model of [anchored, legacyPreset]) {
  finals[model.id] = {} as Record<CountryDatasetId, SimulationRun>;
  for (const ds of DATASETS) {
    const runs = run(model, ds, 120);
    finals[model.id][ds] = runs[120];
    for (const m of [0, 60, 120]) {
      const r = runs[m];
      L.push(`| ${model.id} | ${SHORT[ds]} | ${m} | ${f1(r.state.averageWellbeing)} | ${f1(r.state.countryData.USA.wellbeing)} | ${f1(poor(r))} | ${f3(r.state.countryData.USA.aiAdoption)} | ${r.state.countriesInCrisis ?? 0} | ${f1(r.ledger.monthlyInflow)} |`);
    }
  }
}

// ---- stress (anchored) ------------------------------------------------------------------------
L.push('', '## Stress review of evidence-anchored', '', '| case | dataset | US wellbeing 5 y / 10 y | US unemployment peak (year) | US labour share 10 y | avg wellbeing 10 y | poor-8 10 y |', '|---|---|---|---|---|---|---|');
const baseScenario: Scenario = { model: anchored, corporations: INITIAL_CORPORATIONS.map((c) => ({ ...c })) };
const cases: { label: string; s: Scenario }[] = [
  { label: 'base (DEFAULT_MACRO)', s: baseScenario },
  ...MACRO_STRESS_SWITCH.alternatives.map((a) => ({ label: a.label, s: a.apply(baseScenario) })),
];
for (const c of cases) {
  for (const ds of DATASETS) {
    let peak = 0;
    let peakMonth = 0;
    const runs = run(c.s.model, ds, 120, c.s.corporations, (r) => {
      const u = r.state.countryData.USA.unemployment ?? 0;
      if (u > peak) { peak = u; peakMonth = r.state.month; }
    });
    const r5 = runs[60];
    const r10 = runs[120];
    L.push(`| ${c.label} | ${SHORT[ds]} | ${f1(r5.state.countryData.USA.wellbeing)} / ${f1(r10.state.countryData.USA.wellbeing)} | ${(peak * 100).toFixed(1)}% (yr ${Math.ceil(peakMonth / 12)}) | ${f3(r10.state.countryData.USA.laborShare ?? NaN)} | ${f1(r10.state.averageWellbeing)} | ${f1(poor(r10))} |`);
  }
}

// ---- movers -----------------------------------------------------------------------------------
for (const model of [anchored, legacyPreset]) {
  const a = finals[model.id][LEGACY_COUNTRY_DATASET_ID];
  const b = finals[model.id][WB_COUNTRY_DATASET_ID];
  const rows = Object.keys(b.state.countryData).map((id) => {
    const x = a.state.countryData[id];
    const y = b.state.countryData[id];
    return { id, name: y.name, before: x.wellbeing, after: y.wellbeing, d: y.wellbeing - x.wellbeing, ab: before.get(id)!.archetype, aa: y.archetype };
  }).sort((p, q) => Math.abs(q.d) - Math.abs(p.d));
  L.push('', `## 10 countries whose 10-year wellbeing moves most: ${model.id}`, '', '| id | country | before (legacy-v1) | after (wb-2026-09) | change | archetype before → after |', '|---|---|---|---|---|---|');
  for (const r of rows.slice(0, 10)) L.push(`| ${r.id} | ${r.name} | ${f1(r.before)} | ${f1(r.after)} | ${sgn(r.d)} | ${r.ab === r.aa ? r.aa : `${r.ab} → ${r.aa}`} |`);
  const absMean = rows.reduce((s, r) => s + Math.abs(r.d), 0) / rows.length;
  L.push('', `Mean absolute change over ${rows.length} countries: ${absMean.toFixed(2)} index points.`);
}

// ---- US calibration margin ---------------------------------------------------------------------
// The engine attaches the Korinek US calibration (cognitive share 0.62, natural unemployment 3.9%)
// through the 'rich-democracy' archetype, i.e. through governance >= 0.80 and GDP >= 35,000.
L.push('', '## US archetype margin (Korinek US calibration attaches through it)', '', '| dataset | GDP pc | governance | archetype | cognitive share | margin to 0.80 |', '|---|---|---|---|---|---|');
for (const ds of DATASETS) {
  const us = countriesForDataset(ds).find((c) => c.id === 'USA')!;
  L.push(`| ${SHORT[ds]} | ${us.gdpPerCapita.toFixed(0)} | ${us.governance.toFixed(4)} | ${us.archetype} | ${COGNITIVE_SHARE_BY_ARCHETYPE[us.archetype]} | ${sgn(us.governance - 0.8, 4)} |`);
}

console.log(L.join('\n'));

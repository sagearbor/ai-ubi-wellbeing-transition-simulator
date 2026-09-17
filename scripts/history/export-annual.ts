/** Project saved annual outputs into a small browser artifact; never fit or score. */
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import type { AnnualArtifact, AnnualCountryPath, AnnualMethod, AnnualOutcome, AnnualScore, AnnualTrack } from '../../src/history/annual';

const root = fileURLToPath(new URL('../../', import.meta.url));
const objectiveRoot = 'data/evaluation/annual-objective-20260917';
const wellbeingRoot = 'data/evaluation/annual-wellbeing-20260917';
export const artifactPath = 'data/history/annual-20260917.json';
const read = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const hash = (path: string) => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
const objectiveLabels: Record<string, string> = {
  persistence: 'Persistence · repeat last year', damped_trend: 'Damped historical trend',
  target_shrinkage: 'Target-specific shrinkage', ridge_changes: 'Annual-change ridge',
};
const wellbeingLabels: Record<string, string> = {
  persistence: 'Persistence · repeat last year', damped_trend: 'Half last annual change',
  change_ridge: 'Annual-change model', country_offset: 'Country + annual drivers',
  residual_carry: 'Country + recent residual', shrinkage_change: 'Half model / half persistence',
};
const compactScore = (r: any, wellbeing = false): AnnualScore => ({
  n: r.n, mae: wellbeing ? r.levelMAE : r.mae,
  baselineMAE: wellbeing ? r.persistenceMAE : r.baselineMAE,
  improvementPercent: wellbeing ? r.percentMAEReductionVsPersistence : r.skill === null ? null : 100 * r.skill,
  countries: r.countries ?? 1, missingOutcomes: r.missingOutcomes ?? 0,
});
const select = (methods: AnnualMethod[], pooled: Record<string, AnnualScore>) => [...methods].filter(m => m.kind === 'candidate').sort((a, b) => pooled[a.id].mae - pooled[b.id].mae)[0].id;

export function generateAnnualArtifact(): AnnualArtifact {
  const sourcePaths = [
    `${objectiveRoot}/example-paths.json`, `${objectiveRoot}/metrics.json`, `${objectiveRoot}/coverage.json`,
    `${objectiveRoot}/protocol.json`, `${objectiveRoot}/provenance.json`, `${objectiveRoot}/score-receipt.json`,
    `${wellbeingRoot}/paths.json`, `${wellbeingRoot}/protocol.json`, `${wellbeingRoot}/score-receipt.json`,
    `${wellbeingRoot}/sources/provenance.json`,
    'scripts/history/export-annual.ts', 'src/history/annual.ts',
  ];
  const sourceHashes = Object.fromEntries(sourcePaths.map(path => [path, hash(path)]));
  const objectiveReceipt = read(`${objectiveRoot}/score-receipt.json`);
  const wellbeingReceipt = read(`${wellbeingRoot}/score-receipt.json`);
  for (const [path, expected] of Object.entries(objectiveReceipt.outputs)) {
    const fullPath = `${objectiveRoot}/${path}`;
    if (sourceHashes[fullPath] && sourceHashes[fullPath] !== expected) throw new Error(`Saved evaluation receipt mismatch: ${fullPath}`);
  }
  if (sourceHashes[`${wellbeingRoot}/paths.json`] !== wellbeingReceipt.outputs[`${wellbeingRoot}/paths.json`]) throw new Error('Saved wellbeing receipt mismatch');
  const objective = read(`${objectiveRoot}/example-paths.json`);
  const objectiveMetrics = read(`${objectiveRoot}/metrics.json`);
  const coverage = read(`${objectiveRoot}/coverage.json`);
  const protocol = read(`${objectiveRoot}/protocol.json`);
  const objectiveProvenance = read(`${objectiveRoot}/provenance.json`);
  const wellbeing = read(`${wellbeingRoot}/paths.json`);
  const wellbeingProvenance = read(`${wellbeingRoot}/sources/provenance.json`);
  const countries = protocol.illustratedCountries.map((id: string) => ({ id, name: wellbeing.countries.find((c: any) => c.id === id).name }));
  const tracks = {} as Record<AnnualOutcome, AnnualTrack>;
  for (const target of ['gdp', 'life_expectancy', 'unemployment'] as const) {
    const methods: AnnualMethod[] = objective.methods.map((id: string) => ({ id, label: objectiveLabels[id], kind: id === 'persistence' ? 'baseline' : 'candidate' }));
    const pooled = Object.fromEntries(objectiveMetrics.pooled.filter((r: any) => r.target === target && r.horizon === 1).map((r: any) => [r.method, compactScore(r)]));
    const paths: Record<string, AnnualCountryPath> = {};
    for (const { id } of countries) {
      const predictions = objective.predictions.filter((r: any) => r.country === id && r.target === target && r.horizon === 1);
      const baselineRows = predictions.filter((r: any) => r.method === 'persistence');
      const sourceCoverage = coverage.paths.find((r: any) => r.country === id && r.target === target);
      paths[id] = {
        observed: objective.observations.filter((r: any) => r.country === id && r.target === target).map((r: any) => [r.year, r.value]),
        forecasts: baselineRows.map((r: any) => {
          const matched = methods.map(m => predictions.find((p: any) => p.year === r.year && p.method === m.id));
          if (matched.some(p => !p || p.actual !== r.actual || p.originYear !== r.originYear)) throw new Error('Annual methods do not share an origin/target mask');
          return { year: r.year, originYear: r.originYear, trainingCutoff: r.trainingCutoff, originValue: r.originValue,
            observedChange: r.actualChange, predictions: matched.map(p => p.prediction), changes: matched.map(p => p.predictedChange) };
        }),
        scores: Object.fromEntries(objectiveMetrics.countries.filter((r: any) => r.country === id && r.target === target && r.horizon === 1).map((r: any) => [r.method, compactScore(r)])),
        coverage: { start: 1980, end: 2025, scored: baselineRows.filter((r: any) => r.actual !== null).length,
          missingTarget: sourceCoverage.missingOutcomesByHorizon['1'] ?? 0,
          unavailable: sourceCoverage.skippedOriginsMissingHistoryByHorizon['1'] ?? 0 },
      };
    }
    const source = objectiveProvenance.sources.find((s: any) => s.file === `${objective.targets[target].indicator}-1960-2025.json`);
    tracks[target] = {
      label: { gdp: 'Income · GDP per person', life_expectancy: 'Lifespan · life expectancy', unemployment: 'Unemployment' }[target],
      unit: objective.targets[target].unit, changeUnit: objective.changeUnits[target], scoreUnit: objective.targets[target].scoringUnit,
      source: { label: 'World Bank · World Development Indicators', url: `https://data.worldbank.org/indicator/${objective.targets[target].indicator}`,
        retrievedAt: source.retrievedAt, note: target === 'gdp' ? 'Inflation-adjusted, constant-2015 US dollars; not purchasing-power adjusted.' : target === 'life_expectancy' ? 'Annual source estimates can be modeled or interpolated. Close tracking is not direct yearly measurement.' : 'Modeled International Labour Organization estimates; percent of the labor force. History starts in 1991.' },
      methods, pooled, selected: select(methods, pooled), countries: paths,
    };
  }
  const methods: AnnualMethod[] = wellbeing.methods.map((m: any) => ({ ...m, label: wellbeingLabels[m.id] }));
  const metrics = wellbeing.metrics.rolling;
  const pooled = Object.fromEntries(methods.map(m => [m.id, { ...compactScore(metrics.pooled[m.id], true), countries: metrics.countryCount }]));
  tracks.wellbeing = {
    label: 'Annual wellbeing', unit: 'Cantril ladder points (0–10)', changeUnit: 'ladder points', scoreUnit: 'ladder points',
    source: { label: 'World Happiness Report / Gallup · public annual charts', url: 'https://data.worldhappiness.report/map', retrievedAt: wellbeingProvenance.retrievedAt,
      note: 'Annual survey scores, not three-year averages. Public chart transcription rounded to 0.001 points; rounding is not measurement accuracy. Eight preselected countries only.' },
    methods, pooled, selected: select(methods, pooled),
    countries: Object.fromEntries(wellbeing.countries.map((c: any) => {
      const rows = c.rows.filter((r: any) => r.mode === 'rolling');
      return [c.id, {
        observed: c.observed,
        forecasts: rows.map((r: any) => ({ year: r.year, originYear: r.origin, trainingCutoff: r.fitCutoff,
          originValue: r.previousObserved, observedChange: r.observedChange,
          predictions: methods.map(m => r.predictions[m.id]), changes: methods.map(m => r.predictedChanges[m.id]) })),
        scores: Object.fromEntries(methods.map(m => [m.id, compactScore(metrics.byCountry[c.id][m.id], true)])),
        coverage: { start: 2017, end: 2025, scored: rows.length, missingTarget: 0, unavailable: 9 - rows.length },
      }];
    })),
  };
  const conditional = wellbeing.metrics.conditional;
  return {
    schema: 'annual-history-presentation/1', countries, tracks,
    selection: 'The default candidate has the lowest saved pooled one-year mean absolute error among registered model candidates for this outcome. It is the same candidate for every country, selected after this descriptive comparison, not independently confirmed. All methods, including persistence, remain available.',
    conditional: { scored: conditional.rowCount, countries: conditional.countryCount, start: Math.min(...conditional.years), end: Math.max(...conditional.years), commonMaskSHA256: conditional.commonMaskSHA256,
      note: 'Conditional wellbeing replay uses actual target-year drivers and coefficients frozen at 2016. It is not a forecast. Its 61-row mask differs from the 69-row forecast mask; pooled errors are not a controlled comparison of input quality.' },
    provenance: { operation: 'Read saved annual paths and metrics only; no refitting, rescoring or change to evaluation artifacts.', sourceHashes,
      objective: objectiveProvenance,
      wellbeing: { freezeCommit: wellbeing.provenance.freezeCommit, commonForecastMaskSHA256: metrics.commonMaskSHA256,
        hashes: wellbeing.provenance.hashes, caveats: wellbeing.caveats, targetPrecision: wellbeingProvenance.targetPrecision,
        targetLicense: wellbeingProvenance.targetLicense, sources: wellbeingProvenance.sources },
      receipts: [objectiveReceipt, wellbeingReceipt] },
  };
}
export const serializeAnnualArtifact = (artifact: AnnualArtifact) => `${JSON.stringify(artifact)}\n`;
export function checkAnnualArtifact(stored: string, fresh = generateAnnualArtifact()): void {
  if (stored !== serializeAnnualArtifact(fresh)) throw new Error('Stale or edited annual History export; regenerate from saved outputs');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const artifact = generateAnnualArtifact();
  if (process.argv.includes('--check')) checkAnnualArtifact(readFileSync(resolve(root, artifactPath), 'utf8'), artifact);
  else { mkdirSync(dirname(resolve(root, artifactPath)), { recursive: true }); writeFileSync(resolve(root, artifactPath), serializeAnnualArtifact(artifact)); }
  console.log(`Annual History ${process.argv.includes('--check') ? 'verified' : 'exported'} from saved evidence: ${artifactPath}`);
}

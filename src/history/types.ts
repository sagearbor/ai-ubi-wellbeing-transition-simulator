import type { HindcastRun, HindcastSeriesFile } from '../../validation/hindcast';

export interface HistoryReport {
  fromYear: number;
  toYear: number;
  sources: Record<string, HindcastSeriesFile['source']>;
  coverage: {
    repoCountries: number;
    scored: number;
    unmatched: Array<{ id: string; name: string }>;
    absentFromLadder: string[];
    absentFromGdp: string[];
  };
  runs: Record<string, HindcastRun>;
  baselines: { persistence: { mae: number; nCountries: number }; trendContinuation: { mae: number; nCountries: number } };
}

export interface HistoryArtifact {
  version: 1;
  producingCommand: string;
  checkingCommand: string;
  model: string;
  fitScope: string;
  observationWindow: string;
  calendar: string;
  sourceHashes: Record<string, string>;
  report: HistoryReport;
}

export type HistoryMetric = 'wellbeing' | 'gdp';

export function annualRows(run: HindcastRun, id: string, metric: HistoryMetric) {
  const country = run.countries.find(c => c.id === id);
  if (!country) throw new Error(`Country ${id} is not in the scored cohort`);
  const observed = metric === 'wellbeing' ? country.actualWellbeingSeries : country.actualGdpSeries;
  const modeled = metric === 'wellbeing' ? country.predictedWellbeingSeries : country.predictedGdpSeries;
  const start = observed[0];
  return run.years.map((year, index) => ({ year, observed: observed[index] ?? null, modeled: modeled[index], persistence: start }));
}

/** Presentation-only annual evidence. No fitting or scoring runs in this module. */
export type AnnualOutcome = 'gdp' | 'life_expectancy' | 'unemployment' | 'wellbeing';
export interface AnnualScore {
  n: number; mae: number; baselineMAE: number; improvementPercent: number | null;
  countries: number; missingOutcomes: number;
}
export interface AnnualMethod { id: string; label: string; kind: 'candidate' | 'baseline' }
export interface AnnualForecast {
  year: number; originYear: number; trainingCutoff: number; originValue: number;
  observedChange: number | null; predictions: number[]; changes: number[];
}
export interface AnnualCountryPath {
  observed: Array<[number, number | null]>;
  forecasts: AnnualForecast[];
  scores: Record<string, AnnualScore>;
  coverage: { start: number; end: number; scored: number; missingTarget: number; unavailable: number };
}
export interface AnnualTrack {
  label: string; unit: string; changeUnit: string; scoreUnit: string;
  source: { label: string; url: string; retrievedAt: string; note: string };
  methods: AnnualMethod[]; selected: string; pooled: Record<string, AnnualScore>;
  countries: Record<string, AnnualCountryPath>;
}
export interface AnnualArtifact {
  schema: 'annual-history-presentation/1';
  countries: Array<{ id: string; name: string }>;
  tracks: Record<AnnualOutcome, AnnualTrack>;
  selection: string;
  conditional: { scored: number; countries: number; start: number; end: number; commonMaskSHA256: string; note: string };
  provenance: {
    operation: string; sourceHashes: Record<string, string>;
    objective: unknown; wellbeing: unknown; receipts: unknown[];
  };
}
export interface AnnualDisplayRow {
  year: number; observed: number | null; modeled: number | null; persistence: number | null;
  observedChange: number | null; modeledChange: number | null; persistenceChange: number | null;
  forecast: AnnualForecast | null; status: string;
}
export function annualHistoryRows(track: AnnualTrack, country: string, method: string): AnnualDisplayRow[] {
  const path = track.countries[country];
  if (!path) throw new Error(`Country ${country} is unavailable in this annual track`);
  const methodIndex = track.methods.findIndex(m => m.id === method);
  const persistenceIndex = track.methods.findIndex(m => m.id === 'persistence');
  if (methodIndex < 0 || persistenceIndex < 0) throw new Error(`Unknown annual method: ${method}`);
  const observed = new Map(path.observed);
  const forecasts = new Map(path.forecasts.map(row => [row.year, row]));
  const start = Math.min(...path.observed.map(([year]) => year));
  return Array.from({ length: path.coverage.end - start + 1 }, (_, i) => {
    const year = start + i;
    const value = observed.get(year) ?? null;
    const forecast = forecasts.get(year) ?? null;
    return {
      year, observed: value, modeled: forecast?.predictions[methodIndex] ?? null,
      persistence: forecast?.predictions[persistenceIndex] ?? null,
      // The lower panel uses the same eligible origins as the saved comparison.
      observedChange: forecast?.observedChange ?? null,
      modeledChange: forecast?.changes[methodIndex] ?? null,
      persistenceChange: forecast?.changes[persistenceIndex] ?? null,
      forecast,
      status: forecast ? value === null ? 'Forecast available; target observation missing, unscored' : 'Scored on the common method mask'
        : year < path.coverage.start ? 'History only; before evaluation window' : 'No eligible saved forecast; required target, annual history or drivers missing',
    };
  });
}
export function annualLinePath(rows: AnnualDisplayRow[], key: 'observed' | 'modeled' | 'persistence' | 'observedChange' | 'modeledChange' | 'persistenceChange', x: (year: number) => number, y: (value: number) => number): string {
  let previous: number | null = null;
  return rows.map(row => {
    const value = row[key];
    if (value === null) { previous = null; return ''; }
    const command = previous === row.year - 1 ? 'L' : 'M';
    previous = row.year;
    return `${command}${x(row.year)},${y(value)}`;
  }).join(' ');
}
export const annualFormat = (value: number | null, digits = 2) => value === null ? 'Unavailable' : value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });

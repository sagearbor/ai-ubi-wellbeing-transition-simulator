/** Read-only presentation contract. The evaluator owns all scores and cohort decisions. */
export type HoldoutOutcome = 'ladder' | 'gdp';
export interface HoldoutRow {
  id: string; name: string; year: number; horizon: number;
  ladder: number; gdp: number; originLadder: number; originGdp: number;
  outcome: HoldoutOutcome; actual: number | null; error: number | null;
  persistenceError: number | null; reason: string | null;
}
interface Score { n: number; mae: number | null; rmse: number | null; bias: number | null; reason: string | null }
interface Comparison { expected: number; observed: number; unscored: number; model: Score; persistence: Score; modelMinusPersistenceMae: number | null }
export interface HoldoutArtifact {
  schema: string; title: string;
  protocol: { trainingYears: number[]; originYear: number; testYears: number[]; scope: string; cohort: string; missingness: string; vintageLimit: string };
  origin: { countries: Array<{id: string; name: string}>; excluded: Array<{id: string; reason: string}> };
  trainingExclusions: Array<{id: string; year: number; reason: string}>;
  scores: { rows: HoldoutRow[]; weighting: string; outcomes: Record<HoldoutOutcome, {units: string; overall: Comparison}> };
  limitations: string[]; sourceHashes: Record<string,string>; artifactHashes: Record<string,string>;
  backgroundSources: Record<string,{url: string; retrievedAt: string; lastUpdated: string}>;
  calibrationIdentity: string; protocolHash: string;
}
export function holdoutRows(artifact: HoldoutArtifact, country: string, outcome: HoldoutOutcome) {
  return artifact.scores.rows.filter(r => r.id === country && r.outcome === outcome).sort((a,b)=>a.year-b.year);
}
export function holdoutValues(row: HoldoutRow) {
  return { observed: row.actual, modeled: row.outcome === 'ladder' ? row.ladder : row.gdp,
    persistence: row.outcome === 'ladder' ? row.originLadder : row.originGdp };
}
export const holdoutFormat = (value: number | null, digits = 6) => value === null ? 'Not scored' : value.toLocaleString('en-US',{minimumFractionDigits: digits, maximumFractionDigits: digits});

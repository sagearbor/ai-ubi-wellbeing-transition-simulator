/**
 * US reference path from the faithful port of Korinek, Jones, Sacher, Cotter & McCrory (2026)
 * (data/core/korinek-2026-faithful.json), adapted for the world engine (independent review
 * 2026-09-14, owner decision 4(c)).
 *
 * What the adapter does, and what it deliberately does not do:
 *  - It runs the port with its own time origin (monthly from 2024, so the 2024-2025 prehistory the
 *    paper's state needs is included) and its own exogenous capability/adoption path (m x d). The
 *    world engine's corporation-driven `aiAdoption` is NOT the paper's m x d and is never fed in.
 *  - For the United States only, and only between January 2025 (world month 0) and January 2030
 *    (world month 60, the paper's reporting date), it replaces the reduced-form macro block with the
 *    port's GDP gap, labour income and unemployment. Each output is used once: the reduced-form
 *    displacement pool and labour-share rule are not applied on top.
 *  - After January 2030 the reference has no values. The adapter does not extrapolate: it marks the
 *    US as outside the reference scope, and the world run is expected to stop there.
 *  - It does not apply the US calibration to any other country.
 *  - How labour income and unemployment move wellbeing (the anchored target) is a separate bridge
 *    that has not been reviewed; see the model card.
 */

import { runModel } from '../src/core/engine';
import type { CoreModel, Overlay } from '../src/core/types';
import faithful from '../data/core/korinek-2026-faithful.json';
import modest from '../data/core/overlays/korinek-faithful-modest.json';
import extreme from '../data/core/overlays/korinek-faithful-extreme.json';
import type { CountryStats } from '../types';

/** No-AI labour share (Korinek et al. 2026 calibration), duplicated from pure.ts to avoid an import cycle. */
const BASE_LABOR_SHARE = 0.6;

export type UsReferenceScenario = 'modest' | 'substantial' | 'extreme';

/** World month 0 is January 2025. */
export const WORLD_START_YEAR = 2025;
/** The last world month the reference covers: January 2030. */
export const US_REFERENCE_LAST_WORLD_MONTH = 60;
export const US_REFERENCE_COUNTRY = 'USA';

export interface UsReferencePoint {
  year: number;
  /** GDP per capita relative to the no-AI path, fraction (0.083 = +8.3%). */
  gdpGap: number;
  /** Labour share of income as the port reports it (marginal-product share), fraction. Reported, not fed to the engine. */
  laborShare: number;
  /** Labour income relative to the no-AI path, fraction (the port's own output, for consistency checks). */
  laborIncomeGap: number;
  /** Unemployment rate, all workers, fraction. */
  unemployment: number;
  /** Unemployment rate, cognitive workers, fraction. */
  cognitiveUnemployment: number;
}

export interface UsReferencePath {
  scenario: UsReferenceScenario;
  /** The port's normal (no-AI) unemployment rate, used as the natural rate in this mode. */
  naturalUnemployment: number;
  /** Indexed by port step (month 0 = January 2024). */
  points: UsReferencePoint[];
  manifestHash: string;
}

const OVERLAYS: Record<UsReferenceScenario, Overlay[]> = {
  modest: [modest as unknown as Overlay],
  substantial: [],
  extreme: [extreme as unknown as Overlay],
};

const cache = new Map<UsReferenceScenario, UsReferencePath>();

/** Deterministic and memoised: the port has no ranged parameters. */
export function usReferencePath(scenario: UsReferenceScenario): UsReferencePath {
  const hit = cache.get(scenario);
  if (hit) return hit;
  const model = faithful as unknown as CoreModel;
  const r = runModel(model, { overlays: OVERLAYS[scenario] });
  if (!r.ok) throw new Error(`US reference (${scenario}) failed: ${r.diagnostics.filter((d) => d.level === 'error').map((d) => d.message).join('; ')}`);
  const s = r.series._;
  const points = r.years.map((year, t) => ({
    year,
    gdpGap: s.gdpGapPct[t] / 100,
    laborShare: s.laborSharePct[t] / 100,
    laborIncomeGap: s.laborIncomePct[t] / 100,
    unemployment: s.uAllPct[t] / 100,
    cognitiveUnemployment: s.uCogPct[t] / 100,
  }));
  const path: UsReferencePath = { scenario, naturalUnemployment: r.parameters._.Ubar, points, manifestHash: r.manifest.hash };
  cache.set(scenario, path);
  return path;
}

/** Port step for a world month (world month 0 = January 2025 = port step 12). */
export function portStepForWorldMonth(worldMonth: number): number {
  return (WORLD_START_YEAR - 2024) * 12 + worldMonth;
}

export function usReferenceCovers(worldMonth: number): boolean {
  return worldMonth >= 0 && worldMonth <= US_REFERENCE_LAST_WORLD_MONTH;
}

/**
 * Apply one world month of the US reference to the US record. Mutates `country`. Returns false (and
 * changes nothing) outside the reference window; the caller records that the US is out of scope.
 */
export function applyUsReference(country: CountryStats, worldMonth: number, scenario: UsReferenceScenario, baselineGrowth: number): boolean {
  if (!usReferenceCovers(worldMonth)) return false;
  const path = usReferencePath(scenario);
  const p = path.points[portStepForWorldMonth(worldMonth)];
  if (!p) return false;
  if (country.gdpNoAi === undefined) country.gdpNoAi = country.gdpPerCapita;
  // The no-AI path keeps the world engine's own baseline growth (the paper's no-AI path is ~2%/yr too).
  if (worldMonth > 0) country.gdpNoAi *= 1 + (Math.pow(1 + baselineGrowth, 1 / 12) - 1);
  country.gdpPerCapita = country.gdpNoAi * (1 + p.gdpGap);
  // Labour income is taken from the port's own output (the sum of the two wage bills relative to the
  // no-AI path), used once. The port's printed labour share is a marginal-product income share, and
  // GDP gap x that share differs from its labour-income series by up to 0.7 pp (extreme, 2030), so
  // the engine's labour share is set to the value that reproduces the labour-income series exactly:
  // GDP per capita x laborShare / 0.60 = no-AI GDP x (1 + labour-income gap).
  country.printedLaborShare = p.laborShare;
  country.laborShare = BASE_LABOR_SHARE * (1 + p.laborIncomeGap) / (1 + p.gdpGap);
  country.naturalUnemployment = path.naturalUnemployment;
  country.unemployment = p.unemployment;
  country.cognitiveUnemployment = p.cognitiveUnemployment;
  // The reduced-form displaced pool is not used in this mode.
  country.displacedPool = Math.max(0, p.unemployment - path.naturalUnemployment);
  country.lastAiAdoption = country.aiAdoption;
  return true;
}

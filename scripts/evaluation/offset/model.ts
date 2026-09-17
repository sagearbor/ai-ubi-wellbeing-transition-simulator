/**
 * Country-offset variant of the level model (registered 2026-09-16).
 *
 * The published 2018 holdout entry relaxes every country toward a cross-sectional anchor and keeps no
 * country-specific offset, so it walks countries away from where they actually stay. This variant keeps
 * the origin-year offset and decays it:
 *
 *   ladder(h) = [ anchor(gdp(h), governance) + gap0 * rho^h ] / 10,  gap0 = ladder(origin)*10 - anchor(gdp(origin), governance)
 *
 * `anchor` is the app's own `wellbeingAnchor`; the GDP path is the engine's no-AI path (2%/year, the
 * same assumption the published entry runs with). Only the origin values and coefficients fitted on
 * 2015-2018 enter; no test-era observation is read.
 */
import { wellbeingAnchor } from '../../../simulation/pure';
import type { Origin, Train } from '../partition';
import type { Prediction } from '../predict';

export const OFFSET_VARIANTS = {
  /** rho estimated from training gap transitions (lags 1-3), the registered primary. */
  fitted: 'fitted',
  /** rho = 1: the offset is kept in full, so the model predicts change only through the anchor path. */
  retained: 'retained',
} as const;
export type OffsetVariant = keyof typeof OFFSET_VARIANTS;

export const ANNUAL_BASELINE_GDP_GROWTH = 0.02;
export const MAX_LAG = 3;

/** Pooled least squares of gap(t+h) on rho^h * gap(t) over lags 1..MAX_LAG, training years only. */
export function fitOffsetDecay(train: Train, coefficients: { intercept: number; lnGdp: number; governance: number }): { rho: number; pairs: number; byLag: Array<{ lag: number; rho: number; pairs: number }> } {
  if (JSON.stringify(train.years) !== '[2015,2016,2017,2018]') throw Error('Training years drift');
  const gap = new Map<string, number>();
  for (const c of train.countries) {
    for (const year of train.years) {
      const ladder = train.ladder[c.id]?.[year];
      const gdp = train.gdp[c.id]?.[year];
      if (typeof ladder !== 'number' || typeof gdp !== 'number') continue;
      gap.set(`${c.id}/${year}`, ladder * 10 - anchorAt(gdp, c.governance, coefficients));
    }
  }
  const byLag: Array<{ lag: number; rho: number; pairs: number }> = [];
  let num = 0;
  let den = 0;
  for (let lag = 1; lag <= MAX_LAG; lag++) {
    let ln = 0;
    let ld = 0;
    let pairs = 0;
    for (const [key, value] of gap) {
      const [id, year] = key.split('/');
      const later = gap.get(`${id}/${Number(year) + lag}`);
      if (later === undefined) continue;
      // gap(t+lag) ~ rho^lag * gap(t): weight each lag by its own design so no lag dominates by count.
      ln += value * later;
      ld += value * value;
      pairs++;
    }
    if (!pairs) continue;
    const rhoLag = ln / ld;
    if (!(rhoLag > 0)) throw Error(`Non-positive decay at lag ${lag}`);
    byLag.push({ lag, rho: rhoLag ** (1 / lag), pairs });
    num += Math.log(rhoLag ** (1 / lag)) * pairs;
    den += pairs;
  }
  if (!den) throw Error('No training gap transitions');
  const rho = Math.exp(num / den);
  if (!(rho > 0 && rho <= 1)) throw Error(`Decay outside (0, 1]: ${rho}`);
  return { rho, pairs: den, byLag };
}

function anchorAt(gdp: number, governance: number, k: { intercept: number; lnGdp: number; governance: number }): number {
  return wellbeingAnchor(gdp, governance, k);
}

export function predictOffset(origin: Origin, coefficients: { intercept: number; lnGdp: number; governance: number }, rho: number): Prediction[] {
  if (origin.originYear !== 2018) throw Error('Origin year drift');
  if (!(rho > 0 && rho <= 1)) throw Error('Invalid decay');
  const rows: Prediction[] = [];
  for (const c of origin.countries) {
    if (!(c.gdp > 0) || !Number.isFinite(c.ladder) || c.ladder < 0 || c.ladder > 10) throw Error('Invalid origin outcome');
    const gap0 = c.ladder * 10 - anchorAt(c.gdp, c.governance, coefficients);
    for (let horizon = 1; horizon <= 7; horizon++) {
      const gdp = c.gdp * (1 + ANNUAL_BASELINE_GDP_GROWTH) ** horizon;
      const index = anchorAt(gdp, c.governance, coefficients) + gap0 * rho ** horizon;
      const ladder = Math.max(0.1, Math.min(10, index / 10));
      if (!Number.isFinite(ladder) || !Number.isFinite(gdp)) throw Error('Non-finite prediction');
      rows.push({ id: c.id, name: c.name, year: 2018 + horizon, horizon, ladder, gdp, originLadder: c.ladder, originGdp: c.gdp });
    }
  }
  return rows;
}

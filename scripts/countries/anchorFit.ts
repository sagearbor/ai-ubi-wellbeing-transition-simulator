/**
 * Wellbeing-anchor fit (pure, no I/O).
 *
 * The anchor in simulation/pure.ts is an OLS fit of (WHR Cantril ladder x 10) on
 * ln(GDP per capita, constant 2015 US$) and a country's `governance` value, pooled over the
 * repo's countries in 2015, 2020 and 2025 (data/hindcast/*). `governance` is time-invariant
 * per country (one value per dataset), exactly as the original fit used it.
 *
 * The coefficients are only meaningful together with the governance scale they were fitted
 * on, so every country dataset carries its own fit (data/countries/README.md, "Wellbeing
 * anchor"). This module is what produced both: refitting it on `countries-legacy-v1`
 * reproduces the original 7.454 / 5.103 / 7.658 (see scripts/countries/anchorFit.test.ts).
 */

export interface AnchorFitCountry {
  id: string;
  governance: number;
}

/** ISO3 -> year (string) -> value, the data/hindcast/*.json `data` shape. */
export type CountryYearSeries = Record<string, Record<string, number>>;

export interface AnchorFit {
  intercept: number;
  lnGdp: number;
  governance: number;
  /** Country-years used (country has ladder AND GDP in that year). */
  n: number;
  rSquared: number;
  /** Root mean squared error, 0-100 index points. */
  rmse: number;
  /**
   * Classical OLS standard errors (homoskedastic, independent rows). The rows are the same
   * countries in three years, so these understate the true uncertainty; indicative only.
   */
  se: { intercept: number; lnGdp: number; governance: number };
  years: number[];
}

export const ANCHOR_FIT_YEARS = [2015, 2020, 2025] as const;

/** Solve a small dense linear system by Gauss-Jordan elimination with partial pivoting. */
function solve(a: number[][], b: number[]): number[] {
  const k = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < k; i++) {
    let p = i;
    for (let j = i + 1; j < k; j++) if (Math.abs(m[j][i]) > Math.abs(m[p][i])) p = j;
    [m[i], m[p]] = [m[p], m[i]];
    if (Math.abs(m[i][i]) < 1e-12) throw new Error('anchor fit: singular design matrix');
    for (let j = 0; j < k; j++) {
      if (j === i) continue;
      const f = m[j][i] / m[i][i];
      for (let q = i; q <= k; q++) m[j][q] -= f * m[i][q];
    }
  }
  return m.map((row, i) => row[k] / row[i]);
}

export function fitWellbeingAnchor(
  countries: readonly AnchorFitCountry[],
  ladder: CountryYearSeries,
  gdpConstant2015: CountryYearSeries,
  years: readonly number[] = ANCHOR_FIT_YEARS,
): AnchorFit {
  const x: number[][] = [];
  const y: number[] = [];
  for (const c of countries) {
    if (!Number.isFinite(c.governance)) continue;
    for (const yr of years) {
      const l = ladder[c.id]?.[String(yr)];
      const g = gdpConstant2015[c.id]?.[String(yr)];
      if (typeof l !== 'number' || typeof g !== 'number' || !Number.isFinite(l) || !(g > 0)) continue;
      x.push([1, Math.log(g), c.governance]);
      y.push(l * 10);
    }
  }
  if (y.length < 4) throw new Error(`anchor fit: only ${y.length} country-years`);
  const k = 3;
  const xtx = Array.from({ length: k }, () => Array<number>(k).fill(0));
  const xty = Array<number>(k).fill(0);
  x.forEach((row, i) => {
    for (let p = 0; p < k; p++) {
      xty[p] += row[p] * y[i];
      for (let q = 0; q < k; q++) xtx[p][q] += row[p] * row[q];
    }
  });
  const [intercept, lnGdp, governance] = solve(xtx, xty);
  const meanY = y.reduce((s, v) => s + v, 0) / y.length;
  let sse = 0;
  let sst = 0;
  x.forEach((row, i) => {
    const pred = intercept + lnGdp * row[1] + governance * row[2];
    sse += (y[i] - pred) ** 2;
    sst += (y[i] - meanY) ** 2;
  });
  // (X'X)^-1 column by column, for the standard errors.
  const sigma2 = sse / (y.length - k);
  const inv = [0, 1, 2].map((j) => solve(xtx, [0, 1, 2].map((i) => (i === j ? 1 : 0))));
  const se = { intercept: Math.sqrt(sigma2 * inv[0][0]), lnGdp: Math.sqrt(sigma2 * inv[1][1]), governance: Math.sqrt(sigma2 * inv[2][2]) };
  return { intercept, lnGdp, governance, n: y.length, rSquared: 1 - sse / sst, rmse: Math.sqrt(sse / y.length), se, years: [...years] };
}

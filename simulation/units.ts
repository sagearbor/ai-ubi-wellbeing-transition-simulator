/**
 * Unit conventions shared by the engine and the UI.
 *
 * The world model keeps money in BILLIONS of USD (corporate AI revenue, contributions, the
 * ledger, each country's UBI received) and population in MILLIONS of people. Converting one to
 * the other lives here, once, so the engine and the screens cannot disagree again (review
 * 2026-09-14 finding 13: the map's "Dividend" divided billions by population x 10, understating
 * the payment 10,000-fold, while the engine multiplied the ratio by 1,000).
 */

/** Billions of USD spread over millions of people -> USD per person. 0 when population is not positive. */
export function usdPerPerson(billionsUsd: number, populationMillions: number): number {
  return populationMillions > 0 ? (billionsUsd / populationMillions) * 1000 : 0;
}

/**
 * Sum over countries of (USD per person) x (population in millions) is in MILLIONS of USD; this
 * converts it to billions (e.g. state.globalDisplacementGap, USD/person/month x millions of people).
 */
export function millionsToBillionsUsd(millionsUsd: number): number {
  return millionsUsd / 1000;
}

/** A billions-of-USD amount for display: "$2.28B", "$410M", "$0". */
export function formatBillionsUsd(billionsUsd: number): string {
  if (!Number.isFinite(billionsUsd) || billionsUsd === 0) return '$0';
  const abs = Math.abs(billionsUsd);
  if (abs >= 1000) return `$${(billionsUsd / 1000).toFixed(2)}T`;
  if (abs >= 1) return `$${billionsUsd.toFixed(2)}B`;
  if (abs >= 0.001) return `$${(billionsUsd * 1000).toFixed(0)}M`;
  return `$${(billionsUsd * 1e9).toFixed(0)}`;
}

/** A USD-per-person amount for display: two decimals below $10, whole dollars above. */
export function formatUsdPerPerson(usd: number): string {
  if (!Number.isFinite(usd)) return '$0';
  return usd < 10 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(0)}`;
}

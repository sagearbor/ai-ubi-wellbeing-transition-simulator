/**
 * Stable JSON layout for data/countries/*.json: metadata pretty-printed, one line per country,
 * so a refetch diffs country by country.
 */
export function formatCountryDataset(file: { countries: unknown[] } & Record<string, unknown>): string {
  const { countries, ...meta } = file;
  const head = JSON.stringify(meta, null, 2);
  const rows = countries.map((c) => '    ' + JSON.stringify(c)).join(',\n');
  return head.slice(0, -2) + ',\n  "countries": [\n' + rows + '\n  ]\n}\n';
}

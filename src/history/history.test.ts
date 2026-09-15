import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkArtifact, generateArtifact, sourceHashes, validateArtifact } from '../../scripts/hindcast/export-experience';
import { annualRows, type HistoryArtifact } from './types';

const stored: HistoryArtifact = JSON.parse(readFileSync(new URL('../../data/hindcast/experience.json', import.meta.url), 'utf8'));
let fresh: HistoryArtifact;
beforeAll(() => { fresh = generateArtifact(); }, 30_000);

describe('historical reconstruction artifact', () => {
  it('matches the authoritative rerun and recursively hashed model/data sources', () => {
    expect(() => checkArtifact(stored, fresh)).not.toThrow();
    expect(Object.keys(sourceHashes())).toEqual(expect.arrayContaining([
      'simulation/pure.ts', 'validation/hindcast.ts', 'constants.ts',
      'data/hindcast/wellbeing-ladder.json', 'data/hindcast/gdp-per-capita.json',
      'data/countries/legacy-hand-entered.json', 'scripts/hindcast/run-hindcast.ts',
    ]));
  });
  it('rejects stale sources even when displayed results are unedited', () => {
    const edited = structuredClone(stored);
    edited.sourceHashes['simulation/pure.ts'] = 'stale';
    expect(() => checkArtifact(edited, fresh)).toThrow('Stale historical source hashes');
  });
  it('rejects edited non-headline results without repinning headline targets', () => {
    const edited = structuredClone(stored);
    edited.report.runs['ai-on'].countries[0].predictedGdpSeries[5] += 1;
    expect(() => checkArtifact(edited, fresh)).toThrow('Stale or edited historical results');
  });
  it('rejects missing annual series and missing sensitivity variants', () => {
    const missing = structuredClone(stored);
    missing.report.runs['ai-off'].countries[0].actualGdpSeries.pop();
    expect(() => validateArtifact(missing)).toThrow('Missing or invalid annual series');
    const variant = structuredClone(stored);
    delete variant.report.runs['anchored-ai-on'];
    expect(() => validateArtifact(variant)).toThrow('Missing or unexpected sensitivity run');
  });
  it('preserves observed gaps and computes persistence from the available start', () => {
    const run = structuredClone(stored.report.runs['ai-off']);
    const usa = run.countries.find(c => c.id === 'USA')!;
    usa.actualWellbeingSeries[4] = null;
    const rows = annualRows(run, 'USA', 'wellbeing');
    expect(rows).toHaveLength(11);
    expect(rows[4].observed).toBeNull();
    expect(rows.every(row => row.persistence === usa.actualWellbeingStart)).toBe(true);
    expect(rows[10].modeled).toBe(70.81445034207391);
    expect(rows[10].observed).toBe(68.16);
    expect(() => annualRows(run, 'MISSING', 'gdp')).toThrow('not in the scored cohort');
  });
  it('retains all 106 countries, 22 exclusions, source vintages and every run', () => {
    expect(stored.report.coverage.unmatched).toHaveLength(22);
    expect(Object.keys(stored.report.runs)).toHaveLength(5);
    for (const run of Object.values(stored.report.runs)) {
      expect(run.countries).toHaveLength(106);
      expect(run.dropped.length + run.droppedAtEnd.length).toBe(22);
      for (const c of run.countries) {
        expect(c.predictedWellbeingSeries[0]).toBe(c.actualWellbeingSeries[0]);
        expect(c.predictedGdpSeries[0]).toBe(c.actualGdpSeries[0]);
      }
    }
    expect(stored.report.sources.wellbeingLadder.retrievedAt).toBe('2026-09-10');
  });
});

// Captured Node 22.23.2 vs 26.8.2 differences: only modeled wellbeing output rounding.
const node22WellbeingDifferences = [{"path":["report","runs","ai-on","countries","69","predictedWellbeingSeries","5"],"value":30.511406215375384},{"path":["report","runs","ai-on","countries","69","predictedWellbeingSeries","6"],"value":23.416355518168224},{"path":["report","runs","ai-on","countries","69","predictedWellbeingSeries","7"],"value":16.010574848041134},{"path":["report","runs","ai-on","countries","75","predictedWellbeingEnd"],"value":29.469945898689378},{"path":["report","runs","ai-on","countries","75","predictedWellbeingChange"],"value":-14.570054101310621},{"path":["report","runs","ai-on","countries","75","wellbeingError"],"value":-15.890054101310621},{"path":["report","runs","ai-on","countries","75","predictedWellbeingSeries","5"],"value":62.476803694583985},{"path":["report","runs","ai-on","countries","75","predictedWellbeingSeries","6"],"value":67.9287883100379},{"path":["report","runs","ai-on","countries","75","predictedWellbeingSeries","7"],"value":64.03252737582605},{"path":["report","runs","ai-on","countries","75","predictedWellbeingSeries","8"],"value":55.07552356358416},{"path":["report","runs","ai-on","countries","75","predictedWellbeingSeries","9"],"value":20.569045907074873},{"path":["report","runs","ai-on","countries","75","predictedWellbeingSeries","10"],"value":29.469945898689378}];

describe('runtime numeric portability', () => {
  it('accepts the twelve observed Node 22 Math.pow propagation differences', () => {
    const node22 = structuredClone(fresh);
    for (const { path, value } of node22WellbeingDifferences) {
      let cursor: any = node22;
      for (const key of path.slice(0, -1)) cursor = cursor[key];
      cursor[path[path.length - 1]] = value;
    }
    expect(() => checkArtifact(fresh, node22)).not.toThrow();
  });
  it('still rejects edited observations, modeled values, country errors and aggregate scores', () => {
    const mutations = [
      (a: HistoryArtifact) => { a.report.runs['ai-on'].countries[75].actualWellbeingSeries[5]! *= 1 + Number.EPSILON; },
      (a: HistoryArtifact) => { a.report.runs['ai-on'].countries[75].predictedWellbeingSeries[5] += 1e-10; },
      (a: HistoryArtifact) => { a.report.runs['ai-on'].countries[75].wellbeingError += 1e-10; },
      (a: HistoryArtifact) => { a.report.runs['ai-on'].score.maeWellbeing += 1e-12; },
      (a: HistoryArtifact) => { a.report.runs['ai-on'].countries[75].predictedGdpSeries[5] += 1e-10; },
    ];
    for (const mutate of mutations) {
      const edited = structuredClone(fresh);
      mutate(edited);
      expect(() => checkArtifact(edited, fresh)).toThrow(/Stale or edited historical results at report\.runs\.ai-on\..*: stored=.+, fresh=.+/);
    }
  });
});

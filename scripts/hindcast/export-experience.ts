#!/usr/bin/env tsx
/** Packaging only: the authoritative CLI produces every run, series and score. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, openSync, closeSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { tmpdir } from 'node:os';
import type { HistoryArtifact, HistoryReport } from '../../src/history/types';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = join(ROOT, 'data/hindcast/experience.json');

/** Follow local imports, including JSON and type imports, so model dependencies cannot go stale. */
export function sourceHashes(root = ROOT): Record<string, string> {
  const pending = ['scripts/hindcast/run-hindcast.ts', 'scripts/hindcast/export-experience.ts',
    'data/hindcast/wellbeing-ladder.json', 'data/hindcast/gdp-per-capita.json',
    'data/hindcast/unemployment.json', 'package-lock.json'];
  const hashes: Record<string, string> = {};
  while (pending.length) {
    const name = pending.pop()!;
    if (hashes[name]) continue;
    const full = join(root, name);
    const content = readFileSync(full, 'utf8');
    hashes[name] = createHash('sha256').update(content).digest('hex');
    if (!/\.[cm]?[jt]sx?$/.test(name)) continue;
    for (const imported of ts.preProcessFile(content).importedFiles) {
      if (!imported.fileName.startsWith('.')) continue;
      const base = resolve(dirname(full), imported.fileName);
      const target = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, join(base, 'index.ts')]
        .find(candidate => existsSync(candidate) && /\.[cm]?[jt]sx?$|\.json$/.test(candidate));
      if (!target) throw new Error(`Unresolved local source: ${name} -> ${imported.fileName}`);
      pending.push(relative(root, target));
    }
  }
  return Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)));
}

export function generateArtifact(): HistoryArtifact {
  // The existing CLI calls process.exit: file-backed stdout avoids truncating its buffered JSON.
  const temporary = mkdtempSync(join(tmpdir(), 'history-export-'));
  const output = join(temporary, 'report.json');
  let report: HistoryReport;
  const fd = openSync(output, 'w');
  try {
    execFileSync(process.execPath, ['--import', 'tsx', 'scripts/hindcast/run-hindcast.ts', '--json'],
      { cwd: ROOT, stdio: ['ignore', fd, 'pipe'] });
    report = JSON.parse(readFileSync(output, 'utf8')) as HistoryReport;
  } finally {
    closeSync(fd);
    rmSync(temporary, { recursive: true, force: true });
  }
  const artifact: HistoryArtifact = {
    version: 1,
    producingCommand: 'node --import tsx scripts/hindcast/export-experience.ts',
    checkingCommand: 'node --import tsx scripts/hindcast/export-experience.ts --check',
    model: 'Legacy world model: simulation/pure.ts via validation/hindcast.ts and scripts/hindcast/run-hindcast.ts',
    fitScope: 'Wellbeing anchor fitted using the same 2015–2025 observations; 2015 wellbeing and GDP copied from observations. Not an out-of-sample forecast.',
    observationWindow: '2015–2025, using the pinned source vintages listed below, not the data available in 2015.',
    calendar: 'Annual observations mapped to January of each year; 120 monthly steps from January 2015 to January 2025.',
    sourceHashes: sourceHashes(),
    report,
  };
  validateArtifact(artifact);
  return artifact;
}

export function validateArtifact(artifact: HistoryArtifact): void {
  const report = artifact.report;
  if (artifact.version !== 1 || report.fromYear !== 2015 || report.toYear !== 2025) throw new Error('Unsupported historical artifact');
  const keys = ['ai-off', 'ai-off-ubi-on', 'ai-on', 'anchored-ai-off', 'anchored-ai-on'];
  if (Object.keys(report.runs).sort().join() !== keys.sort().join()) throw new Error('Missing or unexpected sensitivity run');
  if (report.coverage.scored !== 106 || report.coverage.repoCountries !== 128) throw new Error('Published cohort changed');
  for (const run of Object.values(report.runs)) {
    if (run.countries.length !== 106 || new Set(run.countries.map(c => c.id)).size !== 106 || run.years.join() !== '2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025') throw new Error('Incomplete country/year cohort');
    for (const c of run.countries) {
      for (const series of [c.actualWellbeingSeries, c.actualGdpSeries, c.predictedWellbeingSeries, c.predictedGdpSeries]) {
        if (!Array.isArray(series) || series.length !== 11 || series.some(v => v !== null && !Number.isFinite(v))) throw new Error(`Missing or invalid annual series: ${c.id}`);
      }
      if (c.predictedWellbeingSeries.some(v => v === null) || c.predictedGdpSeries.some(v => v === null)) throw new Error(`Missing modeled series: ${c.id}`);
    }
  }
  const base = report.runs['ai-off'];
  const usa = base.countries.find(c => c.id === 'USA');
  if (base.score.maeWellbeing !== 4.532045217834075 || report.baselines.persistence.mae !== 4.679433962264151 ||
    usa?.predictedWellbeingEnd !== 70.81445034207391 || usa?.actualWellbeingEnd !== 68.16 ||
    !base.aiOff || base.corpContributionRate !== 0) throw new Error('Published baseline changed; do not repin targets');
}

/** Only these derived wellbeing leaves accumulate the confirmed Node 22/26 Math.pow rounding.
 * Observations, GDP, aggregates, parameters, baseline targets and all other fields stay exact.
 */
const ROUNDED_WELLBEING_PATH = /^report\.runs\.[^.]+\.countries\.\d+\.(?:predictedWellbeingEnd|predictedWellbeingChange|wellbeingError|predictedWellbeingSeries\.\d+)$/;

function firstResultDifference(stored: unknown, fresh: unknown, path = ''): string | undefined {
  if (stored === fresh) return;
  if (typeof stored === 'number' && typeof fresh === 'number' &&
    Number.isFinite(stored) && Number.isFinite(fresh) && ROUNDED_WELLBEING_PATH.test(path)) {
    const tolerance = 8 * Number.EPSILON * Math.max(1, Math.abs(stored), Math.abs(fresh));
    if (Math.abs(stored - fresh) <= tolerance) return;
  }
  if (stored !== null && fresh !== null && typeof stored === 'object' && typeof fresh === 'object') {
    const storedKeys = Object.keys(stored);
    const freshKeys = Object.keys(fresh);
    if (Array.isArray(stored) !== Array.isArray(fresh) || storedKeys.length !== freshKeys.length ||
      storedKeys.some(key => !Object.hasOwn(fresh, key))) return `${path}: object/array shape differs`;
    for (const key of storedKeys) {
      const difference = firstResultDifference(stored[key], fresh[key], path ? `${path}.${key}` : key);
      if (difference) return difference;
    }
    return;
  }
  return `${path}: stored=${JSON.stringify(stored)}, fresh=${JSON.stringify(fresh)}`;
}

export function checkArtifact(stored: HistoryArtifact, fresh: HistoryArtifact): void {
  validateArtifact(stored);
  if (JSON.stringify(stored.sourceHashes) !== JSON.stringify(fresh.sourceHashes)) throw new Error('Stale historical source hashes; regenerate artifact');
  const difference = firstResultDifference(stored, fresh);
  if (difference) throw new Error(`Stale or edited historical results at ${difference}; regenerate artifact`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fresh = generateArtifact();
  if (process.argv.includes('--check')) {
    checkArtifact(JSON.parse(readFileSync(OUTPUT, 'utf8')), fresh);
    console.log('Historical artifact: hashes and all harness results match.');
  } else {
    writeFileSync(OUTPUT, `${JSON.stringify(fresh)}\n`);
    console.log(`Wrote ${relative(ROOT, OUTPUT)} (${Buffer.byteLength(JSON.stringify(fresh)) + 1} bytes).`);
  }
}

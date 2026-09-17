/** One scored run of the registered country-offset variants. Reads the frozen partition read-only. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fitOffsetDecay, predictOffset } from './model';
import { score } from '../score';

const frozen = 'data/evaluation/level-holdout-2018/';
const here = 'data/evaluation/offset-2018/';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const hash = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const write = (name: string, value: unknown) => writeFileSync(here + name, JSON.stringify(value, null, 2) + '\n');

const protocolHash = hash(here + 'protocol.json');
const partitionHashes = Object.fromEntries(['train.json', 'origin.json', 'test-outcomes.json', 'frozen-fit.json', 'protocol.json'].map((f) => [f, hash(frozen + f)]));
const train = read(frozen + 'train.json');
const origin = read(frozen + 'origin.json');
const test = read(frozen + 'test-outcomes.json');
const coefficients = read(frozen + 'frozen-fit.json').coefficients;

const decay = fitOffsetDecay(train, coefficients);
const variants = { fitted: decay.rho, retained: 1 } as const;
write('fit.json', { protocolHash, partitionHashes, coefficients, decay, variants, note: 'rho estimated from training gap transitions only; coefficients reused unchanged from the frozen fit.' });

const results: Record<string, unknown> = {};
for (const [variant, rho] of Object.entries(variants)) {
  const predictions = predictOffset(origin, coefficients, rho);
  const scored = score(predictions, test);
  write(`predictions-${variant}.json`, { protocolHash, variant, rho, predictions });
  const line = (o: 'ladder' | 'gdp') => {
    const s = (scored.outcomes as any)[o].overall;
    return { n: s.observed, modelMae: s.model.mae, persistenceMae: s.persistence.mae, skill: 1 - s.model.mae / s.persistence.mae, bias: s.model.bias };
  };
  const byYear = (scored.outcomes as any).ladder.byYear.map((y: any) => ({ year: y.year, n: y.observed, modelMae: y.model.mae, persistenceMae: y.persistence.mae, skill: 1 - y.model.mae / y.persistence.mae }));
  results[variant] = { rho, ladder: line('ladder'), gdp: line('gdp'), ladderByYear: byYear };
  write(`scores-${variant}.json`, { protocolHash, variant, rho, ...scored });
}
write('summary.json', { protocolHash, partitionHashes, ranAt: new Date().toISOString().slice(0, 10), results });
console.log(JSON.stringify(results, null, 1));

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '../../../..');
const dir = path.join(root, 'data/evaluation/research-health-2018-v1');
fs.mkdirSync(path.join(dir, 'raw'), { recursive: true });
const queries = [
  ...['SP.DYN.LE00.IN'].flatMap(id => [
    [`${id}-metadata`, `https://api.worldbank.org/v2/indicator/${id}?source=2&format=json&per_page=1000`],
    [`${id}-2015-2018`, `https://api.worldbank.org/v2/country/all/indicator/${id}?date=2015:2018&source=2&format=json&per_page=20000`],
  ]),
];
const sources = [];
for (const [name, url] of queries) {
  const file = path.join(dir, 'raw', `${name}.json`);
  if (fs.existsSync(file)) throw Error(`Refusing to overwrite frozen raw file: ${file}`);
  const retrievedAt = new Date().toISOString();
  const bytes = execFileSync('curl', ['--fail', '--silent', '--show-error', '--location', '--retry', '2', '--max-time', '60', url], { maxBuffer: 20e6 });
  const json = JSON.parse(bytes.toString());
  if (!Array.isArray(json) || !Array.isArray(json[1]) || Number(json[0].pages) !== 1 || Number(json[0].total) !== json[1].length) throw Error(`Invalid or incomplete response: ${name}`);
  const observations = name.endsWith('2015-2018');
  if (observations && json[1].some(r => !Number.isInteger(+r.date) || +r.date < 2015 || +r.date > 2018)) throw Error('Out-of-window response rejected');
  fs.writeFileSync(file, bytes);
  sources.push({ name, url, retrievedAt, relativePath: `raw/${name}.json`, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, responseRows: json[1].length, lastUpdated: json[0].lastupdated ?? null, requestedYears: observations ? [2015,2018] : null, actualYears: observations ? [...new Set(json[1].map(r => +r.date))].sort((a,b)=>a-b) : null, role: observations ? 'training-only observations' : 'metadata only' });
  console.log(`${name}: ${json[1].length} rows; saved without printing observations`);
}
fs.writeFileSync(path.join(dir, 'source-provenance.json'), JSON.stringify({ schema: 'forecast-source-provenance/1', entryId: 'research-health-2018-v1', sources, vintage: 'Current revised source vintage; not archived as-of 2018' }, null, 2)+'\n');

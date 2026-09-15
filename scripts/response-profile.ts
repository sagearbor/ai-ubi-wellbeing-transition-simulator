#!/usr/bin/env tsx
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, createReadStream, statSync, renameSync } from 'node:fs';
import { gzipSync, createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { sourceManifest } from '../build/qualificationSources';
import { runResponseProfile, renderMarkdown, defaultScenario } from '../validation/responseProfile';
import { runConditionalProfile, auditConditionalProfile, renderConditionalMarkdown, conditionalCases, profileConditionalCase } from '../validation/conditionalProfile';
import { PRESET_MODELS } from '../constants';
import { canonicalJson } from '../src/policy/hash';
const sha256Hex = (s: string) => createHash('sha256').update(s).digest('hex');
const contentHash = (v: unknown) => sha256Hex(canonicalJson(v));
const dir = 'data/qualification', rawPath = 'tmp/qualification/world-conditional-v1-profile.jsonl.gz';
const modelArg = process.argv.find(a => a.startsWith('--model='))?.split('=')[1];
const model = modelArg ? PRESET_MODELS.find(m => m.id === modelArg) : defaultScenario().model;
if (!model)
    throw new Error(`Unknown model ${modelArg}`);
function structure() { return sourceManifest(process.cwd()).sources; }
if (process.argv.includes('--refresh-structure')) {
    const sources = structure();
    writeFileSync(`${dir}/world-conditional-v1-structure.json`, JSON.stringify({ hash: contentHash(sources), sources }, null, 2) + '\n');
    process.exit(0);
}
if (model.executionMode) {
    const start = Date.now(), manifestPath = `${dir}/world-conditional-v1-evidence.json`, frozenStructure = JSON.parse(readFileSync(`${dir}/world-conditional-v1-structure.json`, 'utf8'));
    if (contentHash(structure()) !== frozenStructure.hash)
        throw new Error('Sources changed: --refresh-structure, regenerate and independently review before acceptance');
    const { cases: empty, ...header } = runConditionalProfile({ cases: [] });
    const audit = { expected: header.expectedIds.length, attempted: 0, completed: 0, missing: 0, incomplete: 0, altered: 0, duplicates: 0, failures: 0, accountingFailures: 0, outputFailures: 0, pass: false };
    const hashes: string[] = [], ids: string[] = [];
    function inspect(c: ReturnType<typeof profileConditionalCase>) {
        const a = auditConditionalProfile({ ...header, cases: [c] });
        for (const k of ['attempted', 'completed', 'incomplete', 'altered', 'failures', 'accountingFailures', 'outputFailures'] as const)
            audit[k] += a[k];
        ids.push(c.id);
    }
    function finish() { audit.missing = header.expectedIds.filter(id => !ids.includes(id)).length; audit.duplicates = ids.length - new Set(ids).size; audit.pass = audit.missing + audit.incomplete + audit.altered + audit.duplicates + audit.failures + audit.accountingFailures + audit.outputFailures === 0; }
    if (process.argv.includes('--check')) {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        const lines = createInterface({ input: createReadStream(rawPath).pipe(createGunzip()), crlfDelay: Infinity });
        let first = true;
        for await (const line of lines) {
            const row = JSON.parse(line);
            if (first) {
                first = false;
                if (contentHash(row) !== manifest.headerHash || contentHash(row) !== contentHash(header))
                    throw new Error('Altered profile header');
                continue;
            }
            hashes.push(sha256Hex(line));
            inspect(row);
        }
        finish();
        if (contentHash(hashes) !== manifest.payloadHash || frozenStructure.hash !== manifest.structureHash || !audit.pass)
            throw new Error(`Evidence mismatch: ${JSON.stringify(audit)}`);
        console.log(JSON.stringify({ verified: true, audit, payloadHash: manifest.payloadHash, structureHash: manifest.structureHash, seconds: (Date.now() - start) / 1000 }));
    }
    else {
        const freeze = process.argv.includes('--freeze'), writingPath = rawPath + `.${process.pid}.partial`;
        if (freeze) {
            mkdirSync('tmp/qualification', { recursive: true });
            writeFileSync(writingPath, gzipSync(JSON.stringify(header) + '\n'));
        }
        // Retain only the small report fields after each full case is hashed, audited and written.
        const summaries: ReturnType<typeof profileConditionalCase>[] = [];
        for (const c of conditionalCases()) {
            const result = profileConditionalCase(c);
            inspect(result);
            const line = JSON.stringify(result);
            hashes.push(sha256Hex(line));
            if (freeze)
                appendFileSync(writingPath, gzipSync(line + '\n'));
            if (ids.length % 25 === 0)
                console.error(`Profiled ${ids.length}/${header.expectedIds.length} cases`);
            if (process.argv.includes('--json'))
                console.log(line);
            summaries.push({ ...result, months: result.months.map(m => ({ ...m, countries: { USA: m.countries.USA }, budgets: [] })) });
        }
        finish();
        const report = renderConditionalMarkdown({ ...header, cases: summaries }, audit);
        if (freeze) {
            renameSync(writingPath, rawPath);
            writeFileSync(manifestPath, JSON.stringify({ version: header.version, modelId: header.modelId, rawPath, rawBytes: statSync(rawPath).size, headerHash: contentHash(header), payloadHash: contentHash(hashes), caseHashes: hashes, structureHash: frozenStructure.hash, audit, baselineRunIdentities: summaries.find(c => c.id === 'base')!.months.map(m => m.identity), independentReview: 'pending', empiricalSupport: 'not established' }, null, 2) + '\n');
            writeFileSync('docs/design/conditional-response-v1.md', report + '\n');
        }
        if (!process.argv.includes('--json'))
            console.log(report);
        console.error(JSON.stringify({ seconds: (Date.now() - start) / 1000, audit }));
        if (!audit.pass)
            process.exitCode = 1;
    }
}
else {
    const p = runResponseProfile({ scenario: { ...defaultScenario(), model } });
    console.log(process.argv.includes('--json') ? JSON.stringify(p) : renderMarkdown(p));
}

/** Only the two pre-2019 partitions and source metadata are readable numeric inputs. No scorer call. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Train, Origin } from '../../partition';
import type { Prediction } from '../../predict';
import { fit, forecast, crossValidate, validateRows, type Config, type Row, type Fit, type Weights } from './model';

export const ID = 'research-ensemble-2018-v1';
export const FAMILY = 'five-approaches-20260916';
const BASE = `data/evaluation/${ID}/`;
const CODE = `scripts/evaluation/attempts/${ID}/`;
const INPUT = 'data/evaluation/level-holdout-2018/';
const REGISTRATION = '2fee937281751947567ab856047c41ad3cbdba4a';
const bytes = (path: string) => readFileSync(path);
const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const json = (path: string) => JSON.parse(bytes(path).toString());
const encoded = (value: unknown) => JSON.stringify(value, null, 2)+'\n';

export function trainingRows(train: Train): Row[] {
    if (JSON.stringify(train.years) !== '[2015,2016,2017,2018]') throw Error('Unexpected training years');
    if (new Set(train.countries.map(c=>c.id)).size !== train.countries.length) throw Error('Duplicate background country');
    const allowed = new Set(train.countries.map(c=>c.id));
    for (const panel of [train.ladder,train.gdp]) for (const [id, years] of Object.entries(panel)) {
        if (!allowed.has(id)) throw Error('Unexpected panel country');
        if (Object.keys(years).some(y=> !['2015','2016','2017','2018'].includes(y))) throw Error('Future/out-of-window panel');
    }
    const rows: Row[] = [];
    for (const c of [...train.countries].sort((a,b)=>a.id.localeCompare(b.id))) for (const year of train.years) {
        const ladder=train.ladder[c.id]?.[year], gdp=train.gdp[c.id]?.[year];
        if (ladder === undefined && gdp === undefined) continue;
        if (ladder === undefined || gdp === undefined) throw Error('Unpaired training partition');
        rows.push({id:c.id,year,ladder,gdp});
    }
    validateRows(rows);
    return rows;
}

export function makePredictions(model: Fit, origin: Pick<Origin,'originYear'|'countries'>, ladderWeights: Weights, gdpWeights: Weights, damping: number) {
    if (origin.originYear !== 2018 || model.originYear !== 2018) throw Error('Unexpected final origin');
    if (!origin.countries.length || new Set(origin.countries.map(c=>c.id)).size !== origin.countries.length) throw Error('Invalid origin cohort');
    const rows: Prediction[]=[]; let ladderClamps=0;
    for (let horizon=1;horizon<=7;horizon++) for (const c of origin.countries) {
        const f=model.countries.find(x=>x.id===c.id);
        if (!f || f.ladder!==c.ladder || f.gdp!==c.gdp) throw Error('Origin/train value mismatch');
        const ladder=forecast(model,c.id,horizon,'ladder',ladderWeights,damping);
        const gdp=forecast(model,c.id,horizon,'gdp',gdpWeights,damping);
        ladderClamps+=Number(ladder.clamped);
        rows.push({id:c.id,name:c.name,year:2018+horizon,horizon,ladder:ladder.value,gdp:gdp.value,originLadder:c.ladder,originGdp:c.gdp});
    }
    return {rows,ladderClamps};
}

export function generateArtifacts() {
    const protocol=json(BASE+'protocol.json');
    const committed=execFileSync('git',['show',`${REGISTRATION}:${BASE}protocol.json`]);
    if (hash(committed)!==hash(bytes(BASE+'protocol.json'))) throw Error('Registered protocol changed');
    if (protocol.id!==ID || protocol.family!==FAMILY || protocol.amendments.length!==0) throw Error('Protocol identity drift');
    const config: Config={weights:protocol.model.candidateWeights,damping:.8,tolerance:.01};
    const train=json(INPUT+'train.json') as Train;
    const origin=json(INPUT+'origin.json') as Origin;
    const rows=trainingRows(train);
    if (train.countries.length!==101 || rows.length!==399 || origin.countries.length!==100 || origin.excluded.length!==28) throw Error('Frozen partition count drift');
    const validation=crossValidate(rows,config);
    const finalFit=fit(rows,2018);
    const predicted=makePredictions(finalFit,origin,validation.ladder.selected.weights,validation.gdp.selected.weights,config.damping);
    if (predicted.rows.length!==700) throw Error('Final coverage mismatch');
    const sourcePaths=[BASE+'protocol.json',INPUT+'train.json',INPUT+'origin.json',INPUT+'partition-provenance.json',INPUT+'protocol.json',CODE+'model.ts',CODE+'run.ts',CODE+'model.test.ts','package-lock.json'];
    const sourceBindings=Object.fromEntries(sourcePaths.map(path=>[path,hash(bytes(path))]));
    const provenance={schema:'forecast-source-provenance/1',entry:ID,family:FAMILY,registrationCommit:REGISTRATION,
        baseCommit:protocol.baseCommit,sourceBindings,numericalInputs:[INPUT+'train.json',INPUT+'origin.json'],
        parentSourceMetadata:json(INPUT+'partition-provenance.json'),
        runtime:{node:process.version,execution:'node --import tsx',randomness:'none; deterministic iteration and tie order'},
        counts:{trainingCountries:101,pairedTrainingRows:399,originCountries:100,excludedOriginCountries:28,predictions:700},
        originExclusions:origin.excluded,
        externalOutcomes:'Never read or hashed by this worker. Controller owns identity binding and one-shot scoring after six freezes.',
        vintageLimit:protocol.vintageLimit,methods:protocol.sources};
    const calibration={schema:'forecast-calibration/1',entry:ID,family:FAMILY,registrationCommit:REGISTRATION,
        protocolSha256:sourceBindings[BASE+'protocol.json'],trainSha256:sourceBindings[INPUT+'train.json'],
        config,selected:{ladder:{index:validation.ladder.selected.index,weights:validation.ladder.selected.weights},gdp:{index:validation.gdp.selected.index,weights:validation.gdp.selected.weights}},
        fit:finalFit,clamping:{rule:'Final ladder clamp to [0,10]; no GDP cap',finalPredictionCount:predicted.ladderClamps},
        missingHistory:finalFit.countries.filter(c=>c.observations<2).map(c=>({id:c.id,observations:c.observations})),
        status:'frozen-pending-external'};
    const internal={schema:'forecast-internal-validation/1',entry:ID,registrationCommit:REGISTRATION,
        protocolSha256:sourceBindings[BASE+'protocol.json'],units:{ladder:'ladder points',gdp:'cumulative GDP growth error percentage points relative to fold-origin GDP'},
        selectionRule:protocol.internalValidation.selection,limitations:protocol.internalValidation.limitations,...validation};
    const predictions={schema:'forecast-predictions/1',entry:ID,family:FAMILY,originYear:2018,
        protocolSha256:sourceBindings[BASE+'protocol.json'],originSha256:sourceBindings[INPUT+'origin.json'],
        calibrationSha256:hash(encoded(calibration)),rows:predicted.rows};
    const outputs: Record<string,unknown>={'calibration.json':calibration,'internal-validation.json':internal,'source-provenance.json':provenance,'predictions.json':predictions};
    const bindings={...sourceBindings,...Object.fromEntries(Object.entries(outputs).map(([name,value])=>[BASE+name,hash(encoded(value))]))};
    outputs['integrity.json']={schema:'forecast-freeze-integrity/1',entry:ID,family:FAMILY,registrationCommit:REGISTRATION,bindings,
        externalScoringManifest:'Controller-owned; intentionally absent at worker freeze',expectedPredictions:700};
    return outputs;
}

function main() {
    const mode=process.argv[2];
    if (!['--generate','--verify'].includes(mode) || process.argv.length!==3) throw Error('Usage: run.ts --generate|--verify');
    if (mode==='--generate' && ['calibration.json','predictions.json','internal-validation.json','source-provenance.json','integrity.json','scores.json','score-receipt.json'].some(name=>existsSync(BASE+name))) throw Error('Refusing overwrite of existing freeze or score; use --verify');
    const outputs=generateArtifacts();
    for (const [name,value] of Object.entries(outputs)) {
        const expected=encoded(value);
        if (mode==='--verify') {
            if (bytes(BASE+name).toString()!==expected) throw Error(`Reproduction mismatch: ${name}`);
        } else writeFileSync(BASE+name,expected,{flag:'wx'});
    }
    const calibration=outputs['calibration.json'] as any, validation=outputs['internal-validation.json'] as any;
    console.log(JSON.stringify({mode,entry:ID,predictions:700,selected:calibration.selected,
        internal:{ladder:{selected:validation.ladder.selected.score,persistence:validation.ladder.persistence.score},gdp:{selected:validation.gdp.selected.score,persistence:validation.gdp.persistence.score}},ladderClamps:calibration.clamping.finalPredictionCount,externalScoring:'pending; not read or run'},null,2));
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) main();

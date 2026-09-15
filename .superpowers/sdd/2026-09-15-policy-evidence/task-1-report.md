# Task 1 implementation report

Implemented registered pipeline; no score tuning, defaults/observations/targets unchanged. Protocol preregistered at 0b06312.

## Result

100 origin countries; 101 valid historical backgrounds of 128 roster countries. 399 fitted country-years, 113 excluded training rows. Ladder 681 observed of 700, 19 missing; GDP 691 observed of 700, 9 missing. Wellbeing model MAE 0.3175333128080816 versus persistence 0.2897439060205584 (worse by 0.02778940678752323); GDP model cumulative growth MAE 7.511377553252149pp versus persistence 8.6499816020173pp. Initial scores preserved.

Coefficients: {"intercept": 5.569374801665757, "lnGdp": 5.2411916452159915, "governance": 8.224203899441955}. Full precision stored. No accuracy threshold.

## API/source coverage and identities

Registered WGI estimate aliases resolved using official source-3 catalogue (GOV_WGI_*.EST, not .SC). Historical 2015 values, outcome-independent map; no current numeric roster data. Blank ISO3 ignored, no heuristic match. Required missing backgrounds explicitly excluded. Full raw responses committed. Exact metadata:

```json
{
  "SP.POP.TOTL": {
    "path": "data/evaluation/level-holdout-2018/sources/SP.POP.TOTL.json",
    "sha256": "881276f1806917ab6712ff06c5708decb29e53e8f1025f41d0de912c34b3cb44",
    "url": "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?source=2&format=json&per_page=20000&date=2015",
    "retrievedAt": "2026-09-15T18:11:39.228464+00:00",
    "lastUpdated": "2026-07-13",
    "apiIndicator": "SP.POP.TOTL",
    "registeredConcept": "SP.POP.TOTL",
    "rows": 265
  },
  "SI.POV.GINI": {
    "path": "data/evaluation/level-holdout-2018/sources/SI.POV.GINI.json",
    "sha256": "5eaf0277c60a15d7e3c4bcee82d9b123db5248a419e71508054ffa297c4b7550",
    "url": "https://api.worldbank.org/v2/country/all/indicator/SI.POV.GINI?source=2&format=json&per_page=20000&date=2010:2015",
    "retrievedAt": "2026-09-15T18:11:39.230649+00:00",
    "lastUpdated": "2026-07-13",
    "apiIndicator": "SI.POV.GINI",
    "registeredConcept": "SI.POV.GINI",
    "rows": 1590
  },
  "GE.EST": {
    "path": "data/evaluation/level-holdout-2018/sources/GE.EST.json",
    "sha256": "62f1d4e81bd67367fe3ae7e8a88293f4e953e1a3323f35b46cb988409b64b3f8",
    "url": "https://api.worldbank.org/v2/country/all/indicator/GOV_WGI_GE.EST?source=3&format=json&per_page=20000&date=2015",
    "retrievedAt": "2026-09-15T18:11:39.231311+00:00",
    "lastUpdated": "2026-03-18",
    "apiIndicator": "GOV_WGI_GE.EST",
    "registeredConcept": "GE.EST",
    "rows": 216
  },
  "RL.EST": {
    "path": "data/evaluation/level-holdout-2018/sources/RL.EST.json",
    "sha256": "3e622f14ac49d92190251fcdfa38c6818c5c0220455c7889c5871f98f7c2dfbb",
    "url": "https://api.worldbank.org/v2/country/all/indicator/GOV_WGI_RL.EST?source=3&format=json&per_page=20000&date=2015",
    "retrievedAt": "2026-09-15T18:11:39.232470+00:00",
    "lastUpdated": "2026-03-18",
    "apiIndicator": "GOV_WGI_RL.EST",
    "registeredConcept": "RL.EST",
    "rows": 216
  },
  "CC.EST": {
    "path": "data/evaluation/level-holdout-2018/sources/CC.EST.json",
    "sha256": "9791825047ad703237659a84ac16e0b7a8d4fd5f3c611ccc2147bd162663f122",
    "url": "https://api.worldbank.org/v2/country/all/indicator/GOV_WGI_CC.EST?source=3&format=json&per_page=20000&date=2015",
    "retrievedAt": "2026-09-15T18:11:39.233100+00:00",
    "lastUpdated": "2026-03-18",
    "apiIndicator": "GOV_WGI_CC.EST",
    "registeredConcept": "CC.EST",
    "rows": 216
  }
}
```

Protocol SHA-256: 694cc25212c42a84c873a55b7f6db7023e604fd5bbedde2ff9639d2faaaa1c3b

## Files/interfaces

- `scripts/evaluation/partition.ts`: `prepare`, `validateBackground`, types for train/origin/panels; physically partitions before fit.
- `fit.ts`: `fit(Train)` only; existing OLS with explicit 2015–2018 years.
- `predict.ts`: `initialHistoricalState`, `predict`, `evaluationModel`; existing full engine 84 months, frozen object every call. No corporations means no transfers; no policy overlays.
- `score.ts`: `metrics`, `score`; independently masked outcomes, per-country/per-year summaries.
- `run.ts`: prepare/fit/predict/score/package/all; separate OS processes.
- `capture-defaults.ts`, `default-before.json`: pre-edit full output hashes for two datasets and three model variants over 12 months.
- `simulation/pure.ts`: optional finite coefficient override; omitted expression unchanged.
- `constants.ts`: export-only getArchetype; arithmetic unchanged.
- `data/hindcast/experience.json`: ONLY sourceHashes changed, report exact equality confirmed.
- `data/evaluation/level-holdout-2018/experience.json`: UI-ready artifact with `protocol`, `protocolHash`, `calibrationIdentity`, `sourceHashes`, `artifactHashes`, `parameters`, `backgroundSources`, `fit`, `origin`, `trainingExclusions`, `predictions`, `scores`; outcomes under scores.outcomes.ladder/gdp with overall/byYear/byCountry.
- Research disclosure: `docs/research/2026-09-15-level-temporal-holdout.md`.

## Verification

Passed: 27 tests across holdout, pure and app-engine-parity; npm run typecheck; historical export --check. Holdout tests reproduce artifacts, check source hashes, test future-outcome perturbation invariance, temporal feature rejection, identical 84 frozen-calibration calls, inactive-field/default-dataset invariance, no final-year selection, identical persistence masks and null empty metrics.

Commands:

```sh
node --import tsx scripts/evaluation/run.ts all
npx vitest run scripts/evaluation/holdout.test.ts simulation/pure.test.ts simulation/appEngineParity.test.ts
npm run typecheck
node --import tsx scripts/hindcast/export-experience.ts --check
```

Expected deferred failure: `npm run qualification:source-check` reports `Qualification source manifest is stale`. Task2 must fresh-qualify new source identity; old certificate deliberately not repinned. If Task2 changes a transitive hashed dependency, regenerate historical metadata as appropriate and rerun evaluation `package`; do not refit or tune scores to fix qualification. Root owns full gate and UI/live verification.

Revised 2026 vintages and model selected after evaluation years known disclosed; not blind/as-of external validation, not the current conditional-world forecast or evidence for disabled policy channels. No push/merge/deploy.

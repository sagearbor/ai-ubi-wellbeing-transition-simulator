/** Data preparation only. No fit or prediction. All outcome years are partitioned here. */
export type Panel = Record<string, Record<string, number>>;
export type Roster = {
    id: string;
    name: string;
}[];
export type Observation = {
    value: number;
    year: number;
};
export interface Background {
    id: string;
    name: string;
    population: Observation;
    gini: Observation;
    ge: Observation;
    rl: Observation;
    cc: Observation;
    governance: number;
}
export interface OriginCountry extends Background {
    ladder: number;
    gdp: number;
}
export interface Train {
    countries: Background[];
    ladder: Panel;
    gdp: Panel;
    years: number[];
    excluded: {
        id: string;
        year: number;
        reason: string;
    }[];
}
export interface Origin {
    originYear: 2018;
    countries: OriginCountry[];
    excluded: {
        id: string;
        reason: string;
    }[];
}
export type Raw = Record<string, [
    unknown,
    {
        countryiso3code: string;
        date: string;
        value: number | null;
    }[]
]>;
const valid = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function validateBackground(b: Background) {
    for (const key of ['population', 'gini', 'ge', 'rl', 'cc'] as const) {
        const o = b[key];
        if (!o || !valid(o.value) || !Number.isInteger(o.year) || o.year > 2015 || o.year < (key === 'gini' ? 2010 : 2015))
            throw Error(`Invalid historical feature ${b.id}/${key}`);
    }
    const mapped = Math.max(0, Math.min(1, .5 + .2 * (b.ge.value + b.rl.value + b.cc.value) / 3));
    if (b.governance !== mapped || b.population.value <= 0 || b.gini.value < 0 || b.gini.value > 100)
        throw Error(`Invalid background ${b.id}`);
}
export function prepare(roster: Roster, raw: Raw, ladder: Panel, gdp: Panel) {
    const lookup = (indicator: string, id: string, latest = false): Observation | undefined => {
        const matches = raw[indicator][1].filter(x => x.countryiso3code === id && valid(x.value));
        const years = matches.map(x => Number(x.date));
        if (new Set(years).size !== years.length)
            throw Error(`Duplicate ${indicator}/${id}`);
        const row = matches.sort((a, b) => Number(b.date) - Number(a.date))[0];
        if (!row)
            return undefined;
        const o = { value: row.value!, year: Number(row.date) };
        if (o.year > 2015 || o.year < (latest ? 2010 : 2015))
            throw Error(`Future/out-of-window ${indicator}/${id}`);
        return o;
    };
    const countries: Background[] = [], backgroundExcluded: {
        id: string;
        reason: string;
    }[] = [];
    for (const c of roster) {
        const observations = {
            population: lookup('SP.POP.TOTL', c.id), gini: lookup('SI.POV.GINI', c.id, true), ge: lookup('GE.EST', c.id), rl: lookup('RL.EST', c.id), cc: lookup('CC.EST', c.id)
        };
        const missing = Object.entries(observations).filter(([, o]) => !o).map(([k]) => k);
        if (missing.length) {
            backgroundExcluded.push({ id: c.id, reason: `Missing historical ${missing.join(', ')}` });
            continue;
        }
        const b = { ...c, ...observations, governance: Math.max(0, Math.min(1, .5 + .2 * (observations.ge!.value + observations.rl!.value + observations.cc!.value) / 3)) } as Background;
        validateBackground(b);
        countries.push(b);
    }
    const train: Train = {
        countries, ladder: {}, gdp: {}, years: [2015, 2016, 2017, 2018], excluded: []
    };
    const origin: Origin = { originYear: 2018, countries: [], excluded: [...backgroundExcluded] };
    for (const c of roster)
        for (const year of train.years) {
            const b = countries.find(x => x.id === c.id), l = ladder[c.id]?.[year], g = gdp[c.id]?.[year];
            if (!b || !valid(l) || l < 0 || l > 10 || !valid(g) || g <= 0) {
                train.excluded.push({ id: c.id, year, reason: !b ? 'Missing required historical background' : 'Missing/invalid paired training outcomes' });
                continue;
            }
            (train.ladder[c.id] ??= {})[year] = l;
            (train.gdp[c.id] ??= {})[year] = g;
        }
    for (const b of countries) {
        const l = ladder[b.id]?.[2018], g = gdp[b.id]?.[2018];
        if (!valid(l) || l < 0 || l > 10 || !valid(g) || g <= 0)
            origin.excluded.push({ id: b.id, reason: 'Missing/invalid 2018 origin outcomes' });
        else
            origin.countries.push({ ...b, ladder: l, gdp: g });
    }
    const test = { ladder: {} as Panel, gdp: {} as Panel };
    for (const [key, panel] of Object.entries({ ladder, gdp }))
        for (const c of roster)
            for (let year = 2019; year <= 2025; year++) {
                const v = panel[c.id]?.[year];
                if (valid(v))
                    (test[key as 'ladder' | 'gdp'][c.id] ??= {})[year] = v;
            }
    return {
        train, origin, test, backgroundExcluded
    };
}

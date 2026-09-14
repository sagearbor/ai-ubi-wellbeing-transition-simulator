
import { ModelParameters, MacroParameters, CountryStats, Corporation, ScenarioPreset, EquationSet, ModelConfig } from './types';
import legacyCountriesJson from './data/countries/legacy-hand-entered.json';
import wbCountriesJson from './data/countries/wb-2026-09.json';

// Helper to determine archetype based on GDP and governance
type Archetype = 'rich-democracy' | 'middle-stable' | 'developing-fragile' | 'authoritarian' | 'failed-state';
const getArchetype = (gdp: number, gov: number): Archetype => {
  if (gov < 0.35) return 'failed-state';
  if (gov < 0.50 && gdp > 5000) return 'authoritarian';
  if (gdp >= 35000 && gov >= 0.80) return 'rich-democracy';
  if (gdp >= 10000 && gov >= 0.60) return 'middle-stable';
  return 'developing-fragile';
};

/**
 * DEFAULT_MACRO - task-based macro dynamics (see MacroParameters in types.ts).
 * This block is a reduced-form approximation calibrated to the published 2030 outputs of
 * Korinek et al. (2026); not their mechanism. productivityGain and laborShareSensitivity
 * are tuned so the KORINEK_SCENARIOS below land within tolerance of those published
 * numbers - the block does not implement their equations. reemploymentMonths is our own
 * displaced-pool parameter, not the paper's search discount mu (see the field below).
 * wellbeingAnchorRate is 0 in the app so the classic wellbeing behaviour is unchanged (the
 * hindcast turns it on).
 */
export const DEFAULT_MACRO: MacroParameters = {
  baselineGrowth: 0.02,
  productivityGain: 1.13,
  automationShare: 0.5,
  // Our own displaced-pool parameter (mean months to leave the pool below); not the
  // paper's search discount mu - the two are not the same quantity and are not compared.
  reemploymentMonths: 12,
  laborShareSensitivity: 0.88,
  wellbeingAnchorRate: 0,
};

/** Share of employment in cognitive occupations, by archetype (US 62.4% per Korinek et al. 2026). */
export const COGNITIVE_SHARE_BY_ARCHETYPE: Record<Archetype, number> = {
  'rich-democracy': 0.62,
  'middle-stable': 0.45,
  'authoritarian': 0.40,
  'developing-fragile': 0.30,
  'failed-state': 0.20,
};

/** Unemployment rate with no AI displacement, by archetype. */
export const NATURAL_UNEMPLOYMENT_BY_ARCHETYPE: Record<Archetype, number> = {
  'rich-democracy': 0.039,
  'middle-stable': 0.06,
  'authoritarian': 0.05,
  'developing-fragile': 0.08,
  'failed-state': 0.15,
};

/**
 * KORINEK_SCENARIOS - a reduced-form approximation calibrated to the published 2030 outputs
 * of Korinek et al. (2026); not their mechanism. The three scenarios are from Korinek,
 * Jones, Sacher, Cotter & McCrory (2026), "Economic Scenarios for Transformative AI",
 * Anthropic Institute WP 2026-02, expressed as inputs to this engine. `adoption2030` is the
 * share of cognitive tasks AI performs by end-2030 (their m x d), driven exogenously as a
 * logistic path from mid-2026 exactly as their explorer treats capability/adoption as an
 * input. Targets are their published US 2030 outcomes relative to the no-AI path; this
 * engine's macro block is tuned to land within tolerance of those outputs (see
 * validation/korinekTests.ts), not to reproduce their underlying equations.
 * reemploymentMonths per scenario below is our own displaced-pool parameter, not the
 * paper's search discount mu.
 *
 * Targets corrected 2026-09-13 against Table 3 (p. 31): modest cognitive unemployment 2.9 (was 3.9),
 * substantial headline unemployment 4.6 (was 4.3). The published values are for the START of 2030;
 * validation/korinek.ts scores end-2030 (disclosed timing mismatch, not re-tuned).
 */
export interface KorinekScenario {
  id: 'modest' | 'substantial' | 'extreme';
  name: string;
  description: string;
  adoption2030: number;
  macro: MacroParameters;
  targets: { gdpBoostPct: number; cognitiveUnemploymentPct: number; laborSharePct: number; unemploymentPct: number };
}

export const KORINEK_SCENARIOS: KorinekScenario[] = [
  {
    id: 'modest',
    name: 'Modest change (Korinek et al. 2026)',
    description: 'AI acts like a normal technology: roughly the impact of the internet by 2030.',
    adoption2030: 0.023,
    macro: { ...DEFAULT_MACRO, automationShare: 0.1, reemploymentMonths: 6 },
    targets: { gdpBoostPct: 1.6, cognitiveUnemploymentPct: 2.9, laborSharePct: 59.4, unemploymentPct: 3.9 },
  },
  {
    id: 'substantial',
    name: 'Substantial change (Korinek et al. 2026)',
    description: 'A revolution in knowledge work: AI can do about half of it by 2030 and is used widely.',
    adoption2030: 0.118,
    macro: { ...DEFAULT_MACRO, automationShare: 0.2, reemploymentMonths: 12 },
    targets: { gdpBoostPct: 8.3, cognitiveUnemploymentPct: 4.5, laborSharePct: 56.1, unemploymentPct: 4.6 },
  },
  {
    id: 'extreme',
    name: 'Extreme change (Korinek et al. 2026)',
    description: 'Transformative AI: nearly half of today\'s cognitive work done by AI, growth 15%/yr, labour share 45%.',
    adoption2030: 0.45,
    macro: { ...DEFAULT_MACRO, automationShare: 0.9, reemploymentMonths: 18 },
    targets: { gdpBoostPct: 32.4, cognitiveUnemploymentPct: 17.9, laborSharePct: 45.2, unemploymentPct: 11.9 },
  },
];

export const PRESET_MODELS: ModelParameters[] = [
  {
    id: 'organic-incentive',
    name: 'Organic Incentive Model (legacy, illustrative)',
    description: 'Prioritizes corporate speed. Low taxes early to drive 99% adoption, scaling dividends exponentially once the foundation is laid.',
    corporateTaxRate: 0.12,
    adoptionIncentive: 0.30,
    baseUBI: 200,
    aiGrowthRate: 0.09,
    volatility: 0.05,
    gdpScaling: 0.4,
    globalRedistributionRate: 0.3,
    displacementRate: 0.75,
    directToWalletEnabled: false,
    defaultCorpPolicy: 'free-market',
    marketPressure: 0.5
  },
  {
    id: 'social-stability',
    name: 'Social Stability Model',
    description: 'Higher base taxes to prevent the "Subsistence Gap" crash during mid-transition. Slower growth, but safer for human populations.',
    corporateTaxRate: 0.35,
    adoptionIncentive: 0.10,
    baseUBI: 500,
    aiGrowthRate: 0.04,
    volatility: 0.08,
    gdpScaling: 0.7,
    globalRedistributionRate: 0.5,
    displacementRate: 0.70,
    directToWalletEnabled: true,
    defaultCorpPolicy: 'altruistic-start',
    marketPressure: 0.7
  },
  {
    id: 'hyper-surplus',
    name: 'Hyper-Surplus Engine',
    description: 'High volatility, high reward. Extreme incentives to achieve 100% automation in months, relying on massive surplus to fund $2k+ dividends.',
    corporateTaxRate: 0.20,
    adoptionIncentive: 0.50,
    baseUBI: 300,
    aiGrowthRate: 0.15,
    volatility: 0.15,
    gdpScaling: 0.2,
    globalRedistributionRate: 0.2,
    displacementRate: 0.85,
    directToWalletEnabled: false,
    defaultCorpPolicy: 'selfish-start',
    marketPressure: 0.3
  },
  {
    id: 'direct-democracy',
    name: 'Direct Democracy Model',
    description: 'Maximum global redistribution with direct-to-wallet payments. Bypasses corrupt governments via blockchain/digital identity. Best for failed states.',
    corporateTaxRate: 0.40,
    adoptionIncentive: 0.20,
    baseUBI: 400,
    aiGrowthRate: 0.06,
    volatility: 0.10,
    gdpScaling: 0.3,
    globalRedistributionRate: 0.8,
    displacementRate: 0.70,
    directToWalletEnabled: true,
    defaultCorpPolicy: 'altruistic-start',
    marketPressure: 0.8
  },
  {
    id: 'nation-state',
    name: 'Nation-State Focused',
    description: 'Minimal global redistribution. Each nation keeps its own surplus. Rich nations benefit most, poor/corrupt nations struggle.',
    corporateTaxRate: 0.25,
    adoptionIncentive: 0.25,
    baseUBI: 300,
    aiGrowthRate: 0.08,
    volatility: 0.06,
    gdpScaling: 0.5,
    globalRedistributionRate: 0.1,
    displacementRate: 0.75,
    directToWalletEnabled: false,
    defaultCorpPolicy: 'mixed-reality',
    marketPressure: 0.4
  },
  {
    id: 'evidence-anchored',
    name: 'Provisional level model (default)',
    description: 'Same corporations and adoption; wellbeing is a level model with evidence-informed assumptions: anchored on a GDP-equivalent income index and governance (World Happiness Report fit), a log2 cash-transfer effect per doubling of labour income, an unemployment effect via the Korinek-style displaced pool, and an assumed 3-year adjustment half-life. Starts from observed 2025 ladder values. Provisional default: every coefficient is an assumption informed by evidence, not a validated estimate; see the Model Card.',
    corporateTaxRate: 0.12,
    adoptionIncentive: 0.30,
    baseUBI: 200,
    aiGrowthRate: 0.09,
    volatility: 0.05,
    gdpScaling: 0.4,
    globalRedistributionRate: 0.3,
    displacementRate: 0.75,
    directToWalletEnabled: false,
    defaultCorpPolicy: 'free-market',
    marketPressure: 0.5,
    macro: {
      ...DEFAULT_MACRO,
      wellbeingAnchorRate: 0.02,
      wellbeingMode: 'anchored',
      // Evidence-informed ASSUMPTIONS, not estimates (review 2026-09-14, findings 6-7; see
      // docs/design/research/cash-transfer-wellbeing-evidence.md):
      //   transfer: pooled d = 0.13 SD (McGuire et al. 2022, ~2-year follow-up) ~ 0.25-0.3 ladder
      //   points, read as the effect of a transfer that doubles labour income => 2.8 index points per
      //   doubling, log2 form; plausible range 1.6-4 (assumed; a pooled CI is not a slope range).
      //   unemployment: ~0.04-0.05 ladder points per pp (GSOEP direct effect + Di Tella et al.
      //   spillover; possible double count, not verified) => 0.45 index points per pp, range 0.3-1.0.
      // The 0.02/month adjustment speed (3-year half-life) is also assumed: after 24 months only 38%
      // of a constant target change is realised. Not validated for a permanent 100+-country UBI.
      ubiEffectPerDoubling: 2.8,
      unemploymentEffectPerPoint: 0.45,
    },
  }
];

/**
 * US reference variant of the default (review 2026-09-14, owner decision 4(c)): identical to the
 * provisional level model except that the United States follows the faithful port of Korinek et al.
 * (2026), substantial scenario, from January 2025 to January 2030, and the run stops there.
 */
PRESET_MODELS.push({
  ...PRESET_MODELS.find((m) => m.id === 'evidence-anchored')!,
  id: 'us-reference-korinek',
  name: 'Provisional level model + US reference (Korinek et al. 2026, to Jan 2030)',
  description: 'The default provisional level model, with the United States taking GDP, labour share and unemployment from the faithful port of Korinek et al. (2026) instead of the reduced-form block. Only the US, only January 2025 to January 2030; the run stops at the end of the reference. The wellbeing bridge from those outputs is not reviewed.',
  macro: { ...PRESET_MODELS.find((m) => m.id === 'evidence-anchored')!.macro!, usReference: 'substantial' },
});

/**
 * The preset the app opens with (review 2026-09-14, owner decision 4(a)): the corrected level model,
 * presented as provisional with evidence-informed assumptions. The legacy flow model stays in
 * PRESET_MODELS[0] for reproducibility of old scenarios and links.
 */
export const DEFAULT_MODEL_ID = 'evidence-anchored';
export const DEFAULT_MODEL: ModelParameters = PRESET_MODELS.find((m) => m.id === DEFAULT_MODEL_ID)!;

// ============================================================================
// COUNTRY DATASETS (versioned; see data/countries/README.md)
// ============================================================================
// Country inputs are no longer hand-entered here. Each dataset is a JSON file with a value, year,
// source and status per field, and its own wellbeing-anchor coefficients (the coefficients are only
// meaningful on the governance scale they were fitted with). The app default is the sourced World
// Bank dataset; the hand-entered table that lived here until commit bb85a92 is frozen as
// `countries-legacy-v1` so saves and links created before the migration reopen unchanged.

export type CountryFieldStatus = 'observed' | 'legacy-unsourced' | 'missing';

/** One field of one country in a dataset file. */
export interface CountryFieldValue {
  /** In the dataset's convention (data/countries/README.md). null only when status is 'missing'. */
  value: number | null;
  /** Observation year; null for hand-entered values. */
  year: number | null;
  /** Key into the dataset's `sources`. */
  source: string;
  status: CountryFieldStatus;
  /** The value as published, before unit conversion (e.g. persons, Gini 0-100). */
  raw?: number;
  /** Governance only: the WGI estimates the value was derived from. */
  components?: Record<string, number>;
  /** Same-year current-US$ GDP per capita, reference only (never read by the engine). */
  currentUsd?: number;
  note?: string;
}

export interface CountryDatasetRecord {
  id: string;
  name: string;
  population: CountryFieldValue;
  gdpPerCapita: CountryFieldValue;
  gini: CountryFieldValue;
  governance: CountryFieldValue;
}

export interface WellbeingAnchorCoefficients {
  intercept: number;
  lnGdp: number;
  governance: number;
}

export interface CountryDatasetFile {
  datasetId: string;
  title: string;
  sources: Record<string, { name: string; url?: string; lastUpdated?: string; retrievedAt?: string }>;
  conventions: Record<string, string>;
  wellbeingAnchor: WellbeingAnchorCoefficients & { fit?: unknown; before?: unknown; note?: string };
  countries: CountryDatasetRecord[];
  [key: string]: unknown;
}

export const LEGACY_COUNTRY_DATASET_ID = 'countries-legacy-v1';
export const WB_COUNTRY_DATASET_ID = 'countries-wb-2026-09';
export type CountryDatasetId = typeof LEGACY_COUNTRY_DATASET_ID | typeof WB_COUNTRY_DATASET_ID;

const COUNTRY_DATASET_FILES: Record<CountryDatasetId, CountryDatasetFile> = {
  [LEGACY_COUNTRY_DATASET_ID]: legacyCountriesJson as unknown as CountryDatasetFile,
  [WB_COUNTRY_DATASET_ID]: wbCountriesJson as unknown as CountryDatasetFile,
};

export const COUNTRY_DATASET_IDS = Object.keys(COUNTRY_DATASET_FILES) as CountryDatasetId[];

export function isCountryDatasetId(id: unknown): id is CountryDatasetId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(COUNTRY_DATASET_FILES, id);
}

/** The dataset new runs use (review 2026-09-14, owner decision 4(b)). */
export const DEFAULT_COUNTRY_DATASET_ID: CountryDatasetId = WB_COUNTRY_DATASET_ID;

/**
 * The dataset this process uses when nothing else says: the default, or the COUNTRY_DATASET
 * environment variable in Node (CLI reproduction of old results, e.g.
 * `COUNTRY_DATASET=countries-legacy-v1 npm run hindcast`). Browsers have no override.
 */
export const COUNTRY_DATASET_ID: CountryDatasetId = (() => {
  const env = typeof process !== 'undefined' ? process.env?.COUNTRY_DATASET : undefined;
  if (env === undefined || env === '') return DEFAULT_COUNTRY_DATASET_ID;
  if (!isCountryDatasetId(env)) throw new Error(`COUNTRY_DATASET=${env} is not a known country dataset (${COUNTRY_DATASET_IDS.join(', ')})`);
  return env;
})();

export function countryDatasetFile(id: CountryDatasetId): CountryDatasetFile {
  return COUNTRY_DATASET_FILES[id];
}

/** The wellbeing-anchor coefficients fitted on this dataset's governance scale. */
export function wellbeingAnchorCoefficientsFor(id: CountryDatasetId = COUNTRY_DATASET_ID): WellbeingAnchorCoefficients {
  const k = COUNTRY_DATASET_FILES[id].wellbeingAnchor;
  return { intercept: k.intercept, lnGdp: k.lnGdp, governance: k.governance };
}

/** The four engine inputs of one country, read from a dataset record. A 'missing' value is an error, never a default. */
function baseCountryFromRecord(datasetId: CountryDatasetId, r: CountryDatasetRecord) {
  const num = (field: 'population' | 'gdpPerCapita' | 'gini' | 'governance'): number => {
    const v = r[field];
    if (v.value === null || !Number.isFinite(v.value)) {
      throw new Error(`${datasetId}: ${r.id}.${field} has no value (status ${v.status}); the engine needs every field`);
    }
    return v.value;
  };
  return { id: r.id, name: r.name, population: num('population'), gdpPerCapita: num('gdpPerCapita'), governance: num('governance'), gini: num('gini') };
}

// Helper to determine which corporations have HQ in a country
const getHeadquarteredCorps = (countryId: string, corporations: typeof INITIAL_CORPORATIONS): string[] => {
  return corporations
    .filter(corp => corp.headquartersCountry === countryId)
    .map(corp => corp.id);
};

// Helper to determine which corporations operate in a country
const getCustomerOfCorps = (countryId: string, corporations: typeof INITIAL_CORPORATIONS): string[] => {
  return corporations
    .filter(corp => corp.operatingCountries.includes(countryId))
    .map(corp => corp.id);
};

// Helper to determine national policy based on archetype
const getNationalPolicy = (archetype: Archetype, governance: number) => {
  // Authoritarian countries (low governance) block direct wallet
  const allowsDirectWallet = governance >= 0.40;

  // Tax on UBI varies by archetype
  let localTaxOnUbi = 0.1; // default 10%
  if (archetype === 'rich-democracy') {
    localTaxOnUbi = 0.15; // Higher social programs
  } else if (archetype === 'failed-state' || archetype === 'authoritarian') {
    localTaxOnUbi = 0.20; // Extract more revenue
  }

  // Corporate incentives vary (rich democracies compete for HQs)
  let corporateIncentives = 0.1; // default
  if (archetype === 'rich-democracy') {
    corporateIncentives = 0.25; // Compete aggressively for AI HQs
  } else if (archetype === 'middle-stable') {
    corporateIncentives = 0.20;
  } else if (archetype === 'authoritarian' && governance > 0.40) {
    corporateIncentives = 0.30; // China, Singapore-style incentives
  }

  return {
    allowsDirectWallet,
    localTaxOnUbi,
    corporateIncentives
  };
};

// Enrich base data with computed fields (derived with the same rules for every dataset; the
// corporation relationships are added once INITIAL_CORPORATIONS exists, in countriesForDataset).
const enrichCountry = (c: ReturnType<typeof baseCountryFromRecord>) => {
  const archetype = getArchetype(c.gdpPerCapita, c.governance);

  return {
    ...c,
    socialResilience: c.governance, // Backwards compatibility
    corruption: 1 - c.governance,
    archetype,
    participatesInGlobalUBI: true, // All participate by default

    // Corporation relationships - initialized as empty, populated after INITIAL_CORPORATIONS is defined
    headquarteredCorps: [] as string[],
    customerOfCorps: [] as string[],

    // UBI receipt tracking (initialized to 0, updated during simulation)
    ubiReceivedGlobal: 0,
    ubiReceivedLocal: 0,
    ubiReceivedCustomerWeighted: 0,
    totalUbiReceived: 0,

    // National policy
    nationalPolicy: getNationalPolicy(archetype, c.governance),

    // Wellbeing trend (start with current wellbeing, will grow during simulation)
    wellbeingTrend: [70] // Start at neutral wellbeing
  };
};

// Corporation data for Phase 5: Corporation-Centric Architecture
// ~90 major AI companies with realistic initial data
export const INITIAL_CORPORATIONS: Corporation[] = [
  // === TECH GIANTS (USA) ===
  {
    id: 'apple',
    name: 'Apple',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'MEX', 'GBR', 'DEU', 'FRA', 'ITA', 'ESP', 'JPN', 'KOR', 'CHN', 'IND', 'AUS', 'BRA'],
    aiRevenue: 45.0,
    aiAdoptionLevel: 0.65,
    marketCap: 3000.0,
    contributionRate: 0.10,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 75
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'KOR', 'CHN', 'IND', 'AUS', 'BRA', 'MEX', 'NLD', 'SWE'],
    aiRevenue: 65.0,
    aiAdoptionLevel: 0.75,
    marketCap: 2800.0,
    contributionRate: 0.12,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 72
  },
  {
    id: 'google',
    name: 'Google/Alphabet',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'ITA', 'ESP', 'JPN', 'KOR', 'IND', 'BRA', 'AUS', 'MEX', 'IDN', 'THA'],
    aiRevenue: 80.0,
    aiAdoptionLevel: 0.85,
    marketCap: 1800.0,
    contributionRate: 0.15,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 68
  },
  {
    id: 'meta',
    name: 'Meta',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'ITA', 'ESP', 'JPN', 'KOR', 'IND', 'BRA', 'IDN', 'MEX', 'PHL', 'THA'],
    aiRevenue: 35.0,
    aiAdoptionLevel: 0.70,
    marketCap: 900.0,
    contributionRate: 0.08,
    distributionStrategy: 'hq-local' as const,
    policyStance: 'selfish' as const,
    reputationScore: 55
  },
  {
    id: 'amazon',
    name: 'Amazon',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'MEX', 'GBR', 'DEU', 'FRA', 'ITA', 'ESP', 'JPN', 'IND', 'AUS', 'BRA', 'SGP'],
    aiRevenue: 55.0,
    aiAdoptionLevel: 0.72,
    marketCap: 1600.0,
    contributionRate: 0.09,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 62
  },
  {
    id: 'nvidia',
    name: 'Nvidia',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'KOR', 'TWN', 'CHN', 'SGP'],
    aiRevenue: 90.0,
    aiAdoptionLevel: 0.88,
    marketCap: 2200.0,
    contributionRate: 0.10,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 70
  },
  {
    id: 'tesla',
    name: 'Tesla',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'MEX', 'GBR', 'DEU', 'FRA', 'NLD', 'NOR', 'CHN', 'JPN', 'AUS'],
    aiRevenue: 28.0,
    aiAdoptionLevel: 0.68,
    marketCap: 800.0,
    contributionRate: 0.07,
    distributionStrategy: 'hq-local' as const,
    policyStance: 'selfish' as const,
    reputationScore: 58
  },

  // === AI SPECIALISTS (USA) ===
  {
    id: 'openai',
    name: 'OpenAI',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'KOR', 'AUS', 'IND', 'BRA', 'SGP'],
    aiRevenue: 12.0,
    aiAdoptionLevel: 0.95,
    marketCap: 150.0,
    contributionRate: 0.18,
    distributionStrategy: 'global' as const,
    policyStance: 'generous' as const,
    reputationScore: 78
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'AUS'],
    aiRevenue: 3.5,
    aiAdoptionLevel: 0.92,
    marketCap: 40.0,
    contributionRate: 0.20,
    distributionStrategy: 'global' as const,
    policyStance: 'generous' as const,
    reputationScore: 80
  },
  {
    id: 'deepmind',
    name: 'DeepMind (Google)',
    headquartersCountry: 'GBR',
    operatingCountries: ['GBR', 'USA', 'CAN', 'DEU', 'FRA', 'JPN', 'SGP'],
    aiRevenue: 8.0,
    aiAdoptionLevel: 0.90,
    marketCap: 80.0,
    contributionRate: 0.16,
    distributionStrategy: 'global' as const,
    policyStance: 'generous' as const,
    reputationScore: 76
  },
  {
    id: 'cohere',
    name: 'Cohere',
    headquartersCountry: 'CAN',
    operatingCountries: ['CAN', 'USA', 'GBR', 'DEU', 'FRA'],
    aiRevenue: 1.2,
    aiAdoptionLevel: 0.85,
    marketCap: 15.0,
    contributionRate: 0.15,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 72
  },
  {
    id: 'stability-ai',
    name: 'Stability AI',
    headquartersCountry: 'GBR',
    operatingCountries: ['GBR', 'USA', 'CAN', 'DEU', 'FRA', 'JPN'],
    aiRevenue: 0.8,
    aiAdoptionLevel: 0.82,
    marketCap: 10.0,
    contributionRate: 0.12,
    distributionStrategy: 'global' as const,
    policyStance: 'moderate' as const,
    reputationScore: 68
  },
  {
    id: 'midjourney',
    name: 'Midjourney',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'KOR', 'AUS'],
    aiRevenue: 1.5,
    aiAdoptionLevel: 0.88,
    marketCap: 12.0,
    contributionRate: 0.10,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 70
  },

  // === CHINESE TECH GIANTS ===
  {
    id: 'alibaba',
    name: 'Alibaba',
    headquartersCountry: 'CHN',
    operatingCountries: ['CHN', 'IND', 'IDN', 'THA', 'VNM', 'PHL', 'MYS', 'SGP', 'JPN', 'KOR'],
    aiRevenue: 42.0,
    aiAdoptionLevel: 0.68,
    marketCap: 600.0,
    contributionRate: 0.08,
    distributionStrategy: 'hq-local' as const,
    policyStance: 'selfish' as const,
    reputationScore: 60
  },
  {
    id: 'tencent',
    name: 'Tencent',
    headquartersCountry: 'CHN',
    operatingCountries: ['CHN', 'IND', 'IDN', 'THA', 'VNM', 'PHL', 'MYS', 'SGP', 'JPN', 'KOR', 'BRA'],
    aiRevenue: 38.0,
    aiAdoptionLevel: 0.70,
    marketCap: 550.0,
    contributionRate: 0.07,
    distributionStrategy: 'hq-local' as const,
    policyStance: 'selfish' as const,
    reputationScore: 58
  },
  {
    id: 'baidu',
    name: 'Baidu',
    headquartersCountry: 'CHN',
    operatingCountries: ['CHN', 'JPN', 'KOR', 'SGP', 'THA'],
    aiRevenue: 15.0,
    aiAdoptionLevel: 0.75,
    marketCap: 200.0,
    contributionRate: 0.06,
    distributionStrategy: 'hq-local' as const,
    policyStance: 'selfish' as const,
    reputationScore: 56
  },
  {
    id: 'bytedance',
    name: 'ByteDance',
    headquartersCountry: 'CHN',
    operatingCountries: ['CHN', 'USA', 'IND', 'IDN', 'VNM', 'THA', 'PHL', 'JPN', 'KOR', 'BRA', 'MEX'],
    aiRevenue: 25.0,
    aiAdoptionLevel: 0.78,
    marketCap: 300.0,
    contributionRate: 0.05,
    distributionStrategy: 'hq-local' as const,
    policyStance: 'selfish' as const,
    reputationScore: 52
  },

  // === ASIAN TECH LEADERS ===
  {
    id: 'samsung',
    name: 'Samsung',
    headquartersCountry: 'KOR',
    operatingCountries: ['KOR', 'USA', 'CHN', 'JPN', 'IND', 'GBR', 'DEU', 'FRA', 'BRA', 'MEX', 'IDN', 'VNM'],
    aiRevenue: 32.0,
    aiAdoptionLevel: 0.72,
    marketCap: 450.0,
    contributionRate: 0.11,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 68
  },
  {
    id: 'sk-hynix',
    name: 'SK Hynix',
    headquartersCountry: 'KOR',
    operatingCountries: ['KOR', 'USA', 'CHN', 'JPN', 'TWN', 'SGP'],
    aiRevenue: 18.0,
    aiAdoptionLevel: 0.76,
    marketCap: 180.0,
    contributionRate: 0.09,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 65
  },
  {
    id: 'sony',
    name: 'Sony',
    headquartersCountry: 'JPN',
    operatingCountries: ['JPN', 'USA', 'GBR', 'DEU', 'FRA', 'CHN', 'KOR', 'AUS', 'BRA'],
    aiRevenue: 14.0,
    aiAdoptionLevel: 0.65,
    marketCap: 220.0,
    contributionRate: 0.10,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 70
  },
  {
    id: 'softbank',
    name: 'SoftBank',
    headquartersCountry: 'JPN',
    operatingCountries: ['JPN', 'USA', 'GBR', 'CHN', 'IND', 'KOR', 'SGP'],
    aiRevenue: 22.0,
    aiAdoptionLevel: 0.70,
    marketCap: 150.0,
    contributionRate: 0.12,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 66
  },
  {
    id: 'tsmc',
    name: 'TSMC',
    headquartersCountry: 'TWN',
    operatingCountries: ['TWN', 'USA', 'CHN', 'JPN', 'KOR', 'SGP', 'DEU'],
    aiRevenue: 35.0,
    aiAdoptionLevel: 0.80,
    marketCap: 500.0,
    contributionRate: 0.10,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 72
  },

  // === EUROPEAN TECH ===
  {
    id: 'sap',
    name: 'SAP',
    headquartersCountry: 'DEU',
    operatingCountries: ['DEU', 'GBR', 'FRA', 'USA', 'NLD', 'ITA', 'ESP', 'CHN', 'IND', 'BRA'],
    aiRevenue: 12.0,
    aiAdoptionLevel: 0.68,
    marketCap: 180.0,
    contributionRate: 0.14,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 70
  },
  {
    id: 'siemens',
    name: 'Siemens',
    headquartersCountry: 'DEU',
    operatingCountries: ['DEU', 'GBR', 'FRA', 'USA', 'ITA', 'ESP', 'CHN', 'IND', 'BRA', 'MEX'],
    aiRevenue: 16.0,
    aiAdoptionLevel: 0.70,
    marketCap: 220.0,
    contributionRate: 0.13,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 72
  },
  {
    id: 'asml',
    name: 'ASML',
    headquartersCountry: 'NLD',
    operatingCountries: ['NLD', 'USA', 'TWN', 'KOR', 'JPN', 'CHN', 'DEU'],
    aiRevenue: 10.0,
    aiAdoptionLevel: 0.78,
    marketCap: 300.0,
    contributionRate: 0.12,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 74
  },
  {
    id: 'spotify',
    name: 'Spotify',
    headquartersCountry: 'SWE',
    operatingCountries: ['SWE', 'USA', 'GBR', 'DEU', 'FRA', 'ESP', 'ITA', 'BRA', 'MEX', 'ARG', 'AUS'],
    aiRevenue: 3.0,
    aiAdoptionLevel: 0.72,
    marketCap: 45.0,
    contributionRate: 0.15,
    distributionStrategy: 'global' as const,
    policyStance: 'generous' as const,
    reputationScore: 76
  },

  // === ENTERPRISE SOFTWARE & CLOUD ===
  {
    id: 'salesforce',
    name: 'Salesforce',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'AUS', 'IND', 'JPN', 'BRA', 'SGP'],
    aiRevenue: 18.0,
    aiAdoptionLevel: 0.75,
    marketCap: 250.0,
    contributionRate: 0.12,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 70
  },
  {
    id: 'oracle',
    name: 'Oracle',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'IND', 'AUS', 'BRA', 'CHN'],
    aiRevenue: 22.0,
    aiAdoptionLevel: 0.68,
    marketCap: 320.0,
    contributionRate: 0.08,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'selfish' as const,
    reputationScore: 58
  },
  {
    id: 'ibm',
    name: 'IBM',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'IND', 'BRA', 'CHN', 'AUS'],
    aiRevenue: 15.0,
    aiAdoptionLevel: 0.72,
    marketCap: 180.0,
    contributionRate: 0.11,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 65
  },
  {
    id: 'adobe',
    name: 'Adobe',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'IND', 'AUS', 'BRA', 'KOR'],
    aiRevenue: 10.0,
    aiAdoptionLevel: 0.78,
    marketCap: 200.0,
    contributionRate: 0.13,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 72
  },
  {
    id: 'palantir',
    name: 'Palantir',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'GBR', 'DEU', 'FRA', 'AUS', 'JPN', 'ISR'],
    aiRevenue: 5.5,
    aiAdoptionLevel: 0.85,
    marketCap: 60.0,
    contributionRate: 0.07,
    distributionStrategy: 'hq-local' as const,
    policyStance: 'selfish' as const,
    reputationScore: 54
  },

  // === PHARMA & BIOTECH (AI in Drug Discovery) ===
  {
    id: 'pfizer',
    name: 'Pfizer',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'ITA', 'ESP', 'JPN', 'CHN', 'IND', 'BRA', 'AUS'],
    aiRevenue: 8.5,
    aiAdoptionLevel: 0.58,
    marketCap: 280.0,
    contributionRate: 0.10,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 65
  },
  {
    id: 'moderna',
    name: 'Moderna',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'AUS'],
    aiRevenue: 3.2,
    aiAdoptionLevel: 0.65,
    marketCap: 80.0,
    contributionRate: 0.12,
    distributionStrategy: 'global' as const,
    policyStance: 'moderate' as const,
    reputationScore: 68
  },
  {
    id: 'jnj',
    name: 'Johnson & Johnson',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'ITA', 'ESP', 'JPN', 'CHN', 'IND', 'BRA', 'AUS', 'MEX'],
    aiRevenue: 12.0,
    aiAdoptionLevel: 0.62,
    marketCap: 400.0,
    contributionRate: 0.11,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 70
  },
  {
    id: 'novartis',
    name: 'Novartis',
    headquartersCountry: 'CHE',
    operatingCountries: ['CHE', 'USA', 'GBR', 'DEU', 'FRA', 'ITA', 'ESP', 'JPN', 'CHN', 'IND', 'BRA'],
    aiRevenue: 9.0,
    aiAdoptionLevel: 0.60,
    marketCap: 220.0,
    contributionRate: 0.14,
    distributionStrategy: 'global' as const,
    policyStance: 'moderate' as const,
    reputationScore: 72
  },
  {
    id: 'roche',
    name: 'Roche',
    headquartersCountry: 'CHE',
    operatingCountries: ['CHE', 'USA', 'GBR', 'DEU', 'FRA', 'JPN', 'CHN', 'IND', 'BRA'],
    aiRevenue: 10.5,
    aiAdoptionLevel: 0.63,
    marketCap: 280.0,
    contributionRate: 0.13,
    distributionStrategy: 'global' as const,
    policyStance: 'moderate' as const,
    reputationScore: 71
  },

  // === FINANCE & FINTECH (AI in Trading/Risk) ===
  {
    id: 'jpmorgan',
    name: 'JPMorgan Chase',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'CHN', 'IND', 'SGP', 'AUS', 'BRA'],
    aiRevenue: 14.0,
    aiAdoptionLevel: 0.68,
    marketCap: 500.0,
    contributionRate: 0.08,
    distributionStrategy: 'hq-local' as const,
    policyStance: 'selfish' as const,
    reputationScore: 55
  },
  {
    id: 'goldman',
    name: 'Goldman Sachs',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'GBR', 'DEU', 'FRA', 'JPN', 'CHN', 'SGP', 'AUS'],
    aiRevenue: 11.0,
    aiAdoptionLevel: 0.72,
    marketCap: 180.0,
    contributionRate: 0.07,
    distributionStrategy: 'hq-local' as const,
    policyStance: 'selfish' as const,
    reputationScore: 52
  },
  {
    id: 'visa',
    name: 'Visa',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'MEX', 'GBR', 'DEU', 'FRA', 'ITA', 'ESP', 'JPN', 'CHN', 'IND', 'BRA', 'AUS', 'SGP'],
    aiRevenue: 16.0,
    aiAdoptionLevel: 0.75,
    marketCap: 450.0,
    contributionRate: 0.09,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 68
  },
  {
    id: 'mastercard',
    name: 'Mastercard',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'MEX', 'GBR', 'DEU', 'FRA', 'ITA', 'ESP', 'JPN', 'CHN', 'IND', 'BRA', 'AUS'],
    aiRevenue: 13.0,
    aiAdoptionLevel: 0.73,
    marketCap: 380.0,
    contributionRate: 0.09,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 67
  },
  {
    id: 'paypal',
    name: 'PayPal',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'MEX', 'GBR', 'DEU', 'FRA', 'ITA', 'ESP', 'AUS', 'IND', 'BRA', 'JPN'],
    aiRevenue: 7.5,
    aiAdoptionLevel: 0.70,
    marketCap: 100.0,
    contributionRate: 0.10,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 64
  },

  // === AUTOMOTIVE (AI & Autonomous) ===
  {
    id: 'mercedes',
    name: 'Mercedes-Benz',
    headquartersCountry: 'DEU',
    operatingCountries: ['DEU', 'USA', 'GBR', 'FRA', 'ITA', 'CHN', 'JPN', 'KOR', 'BRA', 'MEX'],
    aiRevenue: 9.0,
    aiAdoptionLevel: 0.62,
    marketCap: 180.0,
    contributionRate: 0.11,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 70
  },
  {
    id: 'bmw',
    name: 'BMW',
    headquartersCountry: 'DEU',
    operatingCountries: ['DEU', 'USA', 'GBR', 'FRA', 'ITA', 'CHN', 'JPN', 'BRA'],
    aiRevenue: 8.0,
    aiAdoptionLevel: 0.60,
    marketCap: 160.0,
    contributionRate: 0.11,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 69
  },
  {
    id: 'volkswagen',
    name: 'Volkswagen',
    headquartersCountry: 'DEU',
    operatingCountries: ['DEU', 'USA', 'GBR', 'FRA', 'ITA', 'ESP', 'CHN', 'JPN', 'BRA', 'MEX', 'IND'],
    aiRevenue: 11.0,
    aiAdoptionLevel: 0.58,
    marketCap: 200.0,
    contributionRate: 0.10,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 66
  },
  {
    id: 'toyota',
    name: 'Toyota',
    headquartersCountry: 'JPN',
    operatingCountries: ['JPN', 'USA', 'CHN', 'DEU', 'GBR', 'FRA', 'IND', 'THA', 'IDN', 'BRA', 'MEX', 'AUS'],
    aiRevenue: 13.0,
    aiAdoptionLevel: 0.60,
    marketCap: 320.0,
    contributionRate: 0.10,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 72
  },
  {
    id: 'honda',
    name: 'Honda',
    headquartersCountry: 'JPN',
    operatingCountries: ['JPN', 'USA', 'CHN', 'IND', 'THA', 'IDN', 'BRA', 'MEX'],
    aiRevenue: 7.0,
    aiAdoptionLevel: 0.58,
    marketCap: 140.0,
    contributionRate: 0.09,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 70
  },

  // === ROBOTICS & INDUSTRIAL AI ===
  {
    id: 'abb',
    name: 'ABB',
    headquartersCountry: 'CHE',
    operatingCountries: ['CHE', 'DEU', 'USA', 'GBR', 'FRA', 'CHN', 'IND', 'BRA'],
    aiRevenue: 6.5,
    aiAdoptionLevel: 0.68,
    marketCap: 90.0,
    contributionRate: 0.12,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 68
  },
  {
    id: 'fanuc',
    name: 'Fanuc',
    headquartersCountry: 'JPN',
    operatingCountries: ['JPN', 'USA', 'CHN', 'DEU', 'KOR', 'TWN'],
    aiRevenue: 5.0,
    aiAdoptionLevel: 0.72,
    marketCap: 70.0,
    contributionRate: 0.10,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 66
  },
  {
    id: 'kuka',
    name: 'Kuka',
    headquartersCountry: 'DEU',
    operatingCountries: ['DEU', 'USA', 'CHN', 'JPN', 'FRA', 'ITA'],
    aiRevenue: 3.5,
    aiAdoptionLevel: 0.70,
    marketCap: 50.0,
    contributionRate: 0.11,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 65
  },

  // === RETAIL & E-COMMERCE ===
  {
    id: 'walmart',
    name: 'Walmart',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'MEX', 'GBR', 'CHL', 'ARG'],
    aiRevenue: 12.0,
    aiAdoptionLevel: 0.55,
    marketCap: 420.0,
    contributionRate: 0.08,
    distributionStrategy: 'hq-local' as const,
    policyStance: 'selfish' as const,
    reputationScore: 58
  },
  {
    id: 'jdcom',
    name: 'JD.com',
    headquartersCountry: 'CHN',
    operatingCountries: ['CHN', 'THA', 'IDN', 'VNM'],
    aiRevenue: 10.0,
    aiAdoptionLevel: 0.72,
    marketCap: 150.0,
    contributionRate: 0.07,
    distributionStrategy: 'hq-local' as const,
    policyStance: 'selfish' as const,
    reputationScore: 59
  },
  {
    id: 'shopify',
    name: 'Shopify',
    headquartersCountry: 'CAN',
    operatingCountries: ['CAN', 'USA', 'GBR', 'AUS', 'DEU', 'FRA', 'IND', 'BRA'],
    aiRevenue: 4.0,
    aiAdoptionLevel: 0.68,
    marketCap: 90.0,
    contributionRate: 0.13,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 71
  },

  // === TELECOMMUNICATIONS ===
  {
    id: 'verizon',
    name: 'Verizon',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'MEX'],
    aiRevenue: 8.0,
    aiAdoptionLevel: 0.58,
    marketCap: 180.0,
    contributionRate: 0.08,
    distributionStrategy: 'hq-local' as const,
    policyStance: 'selfish' as const,
    reputationScore: 56
  },
  {
    id: 'att',
    name: 'AT&T',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'MEX'],
    aiRevenue: 7.5,
    aiAdoptionLevel: 0.56,
    marketCap: 160.0,
    contributionRate: 0.07,
    distributionStrategy: 'hq-local' as const,
    policyStance: 'selfish' as const,
    reputationScore: 54
  },
  {
    id: 'vodafone',
    name: 'Vodafone',
    headquartersCountry: 'GBR',
    operatingCountries: ['GBR', 'DEU', 'ITA', 'ESP', 'PRT', 'GRC', 'TUR', 'IND', 'ZAF'],
    aiRevenue: 9.0,
    aiAdoptionLevel: 0.60,
    marketCap: 140.0,
    contributionRate: 0.11,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 64
  },
  {
    id: 'deutsche-telekom',
    name: 'Deutsche Telekom',
    headquartersCountry: 'DEU',
    operatingCountries: ['DEU', 'GBR', 'NLD', 'AUT', 'POL', 'CZE', 'HUN', 'ROU', 'USA'],
    aiRevenue: 10.0,
    aiAdoptionLevel: 0.62,
    marketCap: 170.0,
    contributionRate: 0.12,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 66
  },

  // === SOCIAL MEDIA & CONTENT ===
  {
    id: 'netflix',
    name: 'Netflix',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'MEX', 'BRA', 'ARG', 'GBR', 'DEU', 'FRA', 'ITA', 'ESP', 'JPN', 'KOR', 'IND', 'AUS'],
    aiRevenue: 6.0,
    aiAdoptionLevel: 0.75,
    marketCap: 200.0,
    contributionRate: 0.10,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 68
  },
  {
    id: 'snap',
    name: 'Snap',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'AUS', 'IND', 'BRA'],
    aiRevenue: 2.5,
    aiAdoptionLevel: 0.68,
    marketCap: 35.0,
    contributionRate: 0.08,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 60
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'IND', 'BRA', 'MEX', 'AUS'],
    aiRevenue: 4.0,
    aiAdoptionLevel: 0.65,
    marketCap: 50.0,
    contributionRate: 0.06,
    distributionStrategy: 'hq-local' as const,
    policyStance: 'selfish' as const,
    reputationScore: 48
  },

  // === SEMICONDUCTORS & HARDWARE ===
  {
    id: 'amd',
    name: 'AMD',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'CHN', 'TWN', 'JPN', 'KOR', 'DEU', 'GBR'],
    aiRevenue: 20.0,
    aiAdoptionLevel: 0.80,
    marketCap: 280.0,
    contributionRate: 0.10,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 68
  },
  {
    id: 'intel',
    name: 'Intel',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'CHN', 'JPN', 'KOR', 'TWN', 'DEU', 'GBR', 'IND'],
    aiRevenue: 18.0,
    aiAdoptionLevel: 0.72,
    marketCap: 240.0,
    contributionRate: 0.09,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 64
  },
  {
    id: 'qualcomm',
    name: 'Qualcomm',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CHN', 'JPN', 'KOR', 'TWN', 'IND', 'DEU', 'GBR'],
    aiRevenue: 15.0,
    aiAdoptionLevel: 0.76,
    marketCap: 200.0,
    contributionRate: 0.09,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 66
  },
  {
    id: 'broadcom',
    name: 'Broadcom',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CHN', 'JPN', 'KOR', 'TWN', 'SGP', 'DEU'],
    aiRevenue: 22.0,
    aiAdoptionLevel: 0.78,
    marketCap: 320.0,
    contributionRate: 0.08,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'selfish' as const,
    reputationScore: 60
  },

  // === AEROSPACE & DEFENSE ===
  {
    id: 'boeing',
    name: 'Boeing',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'AUS', 'IND', 'SAU'],
    aiRevenue: 8.0,
    aiAdoptionLevel: 0.62,
    marketCap: 180.0,
    contributionRate: 0.07,
    distributionStrategy: 'hq-local' as const,
    policyStance: 'selfish' as const,
    reputationScore: 52
  },
  {
    id: 'lockheed',
    name: 'Lockheed Martin',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'GBR', 'DEU', 'AUS', 'JPN', 'ISR', 'SAU'],
    aiRevenue: 9.0,
    aiAdoptionLevel: 0.68,
    marketCap: 130.0,
    contributionRate: 0.06,
    distributionStrategy: 'hq-local' as const,
    policyStance: 'selfish' as const,
    reputationScore: 50
  },
  {
    id: 'airbus',
    name: 'Airbus',
    headquartersCountry: 'FRA',
    operatingCountries: ['FRA', 'DEU', 'GBR', 'ESP', 'USA', 'CHN', 'IND', 'JPN', 'AUS'],
    aiRevenue: 10.0,
    aiAdoptionLevel: 0.65,
    marketCap: 160.0,
    contributionRate: 0.12,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 68
  },

  // === ENERGY & OIL ===
  {
    id: 'shell',
    name: 'Shell',
    headquartersCountry: 'GBR',
    operatingCountries: ['GBR', 'USA', 'NLD', 'DEU', 'NGA', 'SAU', 'ARE', 'AUS', 'CHN', 'IND', 'BRA'],
    aiRevenue: 12.0,
    aiAdoptionLevel: 0.55,
    marketCap: 220.0,
    contributionRate: 0.08,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'selfish' as const,
    reputationScore: 56
  },
  {
    id: 'bp',
    name: 'BP',
    headquartersCountry: 'GBR',
    operatingCountries: ['GBR', 'USA', 'DEU', 'ITA', 'ESP', 'SAU', 'ARE', 'AUS', 'IND'],
    aiRevenue: 10.0,
    aiAdoptionLevel: 0.54,
    marketCap: 180.0,
    contributionRate: 0.08,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'selfish' as const,
    reputationScore: 54
  },
  {
    id: 'exxon',
    name: 'ExxonMobil',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'MEX', 'GBR', 'DEU', 'SAU', 'ARE', 'NGA', 'AUS'],
    aiRevenue: 14.0,
    aiAdoptionLevel: 0.56,
    marketCap: 420.0,
    contributionRate: 0.07,
    distributionStrategy: 'hq-local' as const,
    policyStance: 'selfish' as const,
    reputationScore: 50
  },

  // === FOOD & CONSUMER GOODS ===
  {
    id: 'nestle',
    name: 'Nestlé',
    headquartersCountry: 'CHE',
    operatingCountries: ['CHE', 'USA', 'DEU', 'FRA', 'GBR', 'ITA', 'ESP', 'BRA', 'MEX', 'CHN', 'IND', 'JPN', 'AUS'],
    aiRevenue: 11.0,
    aiAdoptionLevel: 0.58,
    marketCap: 340.0,
    contributionRate: 0.13,
    distributionStrategy: 'global' as const,
    policyStance: 'moderate' as const,
    reputationScore: 70
  },
  {
    id: 'unilever',
    name: 'Unilever',
    headquartersCountry: 'GBR',
    operatingCountries: ['GBR', 'USA', 'NLD', 'DEU', 'FRA', 'ITA', 'BRA', 'IND', 'CHN', 'IDN', 'MEX', 'ZAF'],
    aiRevenue: 9.5,
    aiAdoptionLevel: 0.56,
    marketCap: 280.0,
    contributionRate: 0.14,
    distributionStrategy: 'global' as const,
    policyStance: 'moderate' as const,
    reputationScore: 72
  },
  {
    id: 'procter-gamble',
    name: 'Procter & Gamble',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'MEX', 'GBR', 'DEU', 'FRA', 'BRA', 'CHN', 'IND', 'JPN', 'AUS'],
    aiRevenue: 10.0,
    aiAdoptionLevel: 0.57,
    marketCap: 360.0,
    contributionRate: 0.10,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 68
  },

  // === GAMING & ENTERTAINMENT ===
  {
    id: 'electronic-arts',
    name: 'Electronic Arts',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'KOR', 'BRA', 'AUS'],
    aiRevenue: 4.5,
    aiAdoptionLevel: 0.75,
    marketCap: 90.0,
    contributionRate: 0.09,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 62
  },
  {
    id: 'activision',
    name: 'Activision Blizzard',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'KOR', 'CHN', 'BRA', 'AUS'],
    aiRevenue: 5.5,
    aiAdoptionLevel: 0.72,
    marketCap: 120.0,
    contributionRate: 0.08,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 60
  },
  {
    id: 'tencent-games',
    name: 'Tencent Games',
    headquartersCountry: 'CHN',
    operatingCountries: ['CHN', 'JPN', 'KOR', 'USA', 'IDN', 'THA', 'VNM', 'PHL'],
    aiRevenue: 12.0,
    aiAdoptionLevel: 0.78,
    marketCap: 200.0,
    contributionRate: 0.06,
    distributionStrategy: 'hq-local' as const,
    policyStance: 'selfish' as const,
    reputationScore: 56
  },
  {
    id: 'nintendo',
    name: 'Nintendo',
    headquartersCountry: 'JPN',
    operatingCountries: ['JPN', 'USA', 'GBR', 'DEU', 'FRA', 'AUS', 'KOR'],
    aiRevenue: 5.0,
    aiAdoptionLevel: 0.60,
    marketCap: 140.0,
    contributionRate: 0.10,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 74
  },

  // === CLOUD & INFRASTRUCTURE ===
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'AUS', 'SGP', 'BRA', 'IND'],
    aiRevenue: 2.8,
    aiAdoptionLevel: 0.82,
    marketCap: 50.0,
    contributionRate: 0.14,
    distributionStrategy: 'global' as const,
    policyStance: 'moderate' as const,
    reputationScore: 72
  },
  {
    id: 'snowflake',
    name: 'Snowflake',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'AUS', 'SGP'],
    aiRevenue: 3.5,
    aiAdoptionLevel: 0.80,
    marketCap: 70.0,
    contributionRate: 0.12,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 70
  },
  {
    id: 'databricks',
    name: 'Databricks',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'AUS', 'IND'],
    aiRevenue: 4.0,
    aiAdoptionLevel: 0.85,
    marketCap: 60.0,
    contributionRate: 0.13,
    distributionStrategy: 'customer-weighted' as const,
    policyStance: 'moderate' as const,
    reputationScore: 71
  }
];

export type InitialCountry = ReturnType<typeof enrichCountry>;

const COUNTRIES_BY_DATASET = new Map<CountryDatasetId, InitialCountry[]>();

/**
 * The initial country table of a dataset: the four sourced (or flagged) inputs, the derived fields
 * (archetype, socialResilience, corruption, national policy) and the corporation relationships.
 * Built once per dataset; callers must not mutate the records (the engine clones them).
 */
export function countriesForDataset(id: CountryDatasetId = COUNTRY_DATASET_ID): InitialCountry[] {
  let out = COUNTRIES_BY_DATASET.get(id);
  if (!out) {
    out = COUNTRY_DATASET_FILES[id].countries.map((r) => {
      const c = enrichCountry(baseCountryFromRecord(id, r));
      return {
        ...c,
        headquarteredCorps: getHeadquarteredCorps(c.id, INITIAL_CORPORATIONS),
        customerOfCorps: getCustomerOfCorps(c.id, INITIAL_CORPORATIONS),
      };
    });
    COUNTRIES_BY_DATASET.set(id, out);
  }
  return out;
}

/** World population (millions) the global pool is shared over, for a dataset. */
export function worldPopulationMillionsFor(id: CountryDatasetId = COUNTRY_DATASET_ID): number {
  return countriesForDataset(id).reduce((a, c) => a + c.population, 0);
}

/** The shipped initial country table (dataset COUNTRY_DATASET_ID). */
export const INITIAL_COUNTRIES = countriesForDataset(COUNTRY_DATASET_ID);

/**
 * SCENARIO_PRESETS - Pre-configured scenarios demonstrating different game theory outcomes.
 * Each scenario sets up specific corporation policies and model parameters to explore
 * various equilibria: cooperation, defection, protectionism, etc.
 */
export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'free-market-optimism',
    name: 'Free Market Optimism',
    description: 'All corps start moderate (20% contribution), adaptive policies enabled. Shows emergent cooperation.',
    modelParams: {
      defaultCorpPolicy: 'free-market',
      marketPressure: 0.6,
      aiGrowthRate: 0.08,
      displacementRate: 0.75
    },
    corporationOverrides: [
      {
        filter: () => true,
        updates: {
          contributionRate: 0.20,
          policyStance: 'moderate',
          distributionStrategy: 'customer-weighted'
        }
      }
    ]
  },
  {
    id: 'race-to-bottom',
    name: 'Race to Bottom',
    description: 'All corps start selfish (5% contribution), adaptive disabled. Shows worst case.',
    modelParams: {
      defaultCorpPolicy: 'selfish-start',
      marketPressure: 0.2,
      aiGrowthRate: 0.10,
      displacementRate: 0.85
    },
    corporationOverrides: [
      {
        filter: () => true,
        updates: {
          contributionRate: 0.05,
          policyStance: 'selfish',
          distributionStrategy: 'hq-local'
        }
      }
    ]
  },
  {
    id: 'corporate-altruism',
    name: 'Corporate Altruism',
    description: 'All corps generous (40% contribution), global distribution. Best case scenario.',
    modelParams: {
      defaultCorpPolicy: 'altruistic-start',
      marketPressure: 0.8,
      aiGrowthRate: 0.06,
      displacementRate: 0.70
    },
    corporationOverrides: [
      {
        filter: () => true,
        updates: {
          contributionRate: 0.40,
          policyStance: 'generous',
          distributionStrategy: 'global'
        }
      }
    ]
  },
  {
    id: 'us-protectionism',
    name: 'US Protectionism',
    description: 'US corps all HQ-local, others customer-weighted. Shows nationalism effects.',
    modelParams: {
      defaultCorpPolicy: 'mixed-reality',
      marketPressure: 0.5,
      aiGrowthRate: 0.08,
      displacementRate: 0.75
    },
    corporationOverrides: [
      {
        filter: (c) => c.headquartersCountry === 'USA',
        updates: {
          distributionStrategy: 'hq-local',
          policyStance: 'selfish',
          contributionRate: 0.08
        }
      },
      {
        filter: (c) => c.headquartersCountry !== 'USA',
        updates: {
          distributionStrategy: 'customer-weighted',
          contributionRate: 0.18
        }
      }
    ]
  },
  {
    id: 'china-dominance',
    name: 'China Dominance',
    description: 'Chinese corps are selfish and protectionist while others cooperate.',
    modelParams: {
      defaultCorpPolicy: 'mixed-reality',
      marketPressure: 0.5,
      aiGrowthRate: 0.09,
      displacementRate: 0.75
    },
    corporationOverrides: [
      {
        filter: (c) => c.headquartersCountry === 'CHN',
        updates: {
          distributionStrategy: 'hq-local',
          contributionRate: 0.08,
          policyStance: 'selfish'
        }
      },
      {
        filter: (c) => c.headquartersCountry !== 'CHN',
        updates: {
          distributionStrategy: 'customer-weighted',
          contributionRate: 0.25,
          policyStance: 'moderate'
        }
      }
    ]
  },
  {
    id: 'eu-solidarity',
    name: 'EU Solidarity',
    description: 'EU corps cooperate via global distribution, US/China compete via local strategies.',
    modelParams: {
      defaultCorpPolicy: 'mixed-reality',
      marketPressure: 0.6,
      aiGrowthRate: 0.07,
      displacementRate: 0.72
    },
    corporationOverrides: [
      {
        filter: (c) => ['DEU', 'FRA', 'GBR', 'ITA', 'ESP', 'NLD', 'SWE', 'BEL', 'AUT', 'POL', 'NOR', 'CHE', 'IRL', 'DNK', 'FIN', 'PRT'].includes(c.headquartersCountry),
        updates: {
          distributionStrategy: 'global',
          contributionRate: 0.30,
          policyStance: 'generous'
        }
      },
      {
        filter: (c) => c.headquartersCountry === 'USA' || c.headquartersCountry === 'CHN',
        updates: {
          distributionStrategy: 'hq-local',
          contributionRate: 0.10,
          policyStance: 'selfish'
        }
      },
      {
        filter: (c) => !['DEU', 'FRA', 'GBR', 'ITA', 'ESP', 'NLD', 'SWE', 'BEL', 'AUT', 'POL', 'NOR', 'CHE', 'IRL', 'DNK', 'FIN', 'PRT', 'USA', 'CHN'].includes(c.headquartersCountry),
        updates: {
          distributionStrategy: 'customer-weighted',
          contributionRate: 0.18,
          policyStance: 'moderate'
        }
      }
    ]
  }
];

/**
 * DEFAULT_EQUATIONS - Reference implementation extracted from stepSimulation
 * These equations encode the standard causal model for the simulator.
 * User-uploaded models can override these, but must pass anchor tests.
 */
export const DEFAULT_EQUATIONS: EquationSet = {
  // AI adoption growth formula
  // Variables: aiGrowthRate, gdpPerCapita, aiAdoptionLevel, adoption (country)
  aiAdoptionGrowth: 'aiGrowthRate * (1 + gdpPerCapita / 100000) * aiAdoptionLevel * 0.1 * (1 - adoption)',

  // Corporation surplus generation
  // Variables: aiRevenue, contributionRate
  surplusGeneration: 'aiRevenue * contributionRate',

  // Wellbeing change formula
  // Variables: ubiBoost, displacementFriction
  // Coefficients: UBI boost = 0.20, Displacement friction = 0.12
  wellbeingDelta: 'ubiBoost * 0.20 - displacementFriction * 0.12',

  // Displacement friction formula
  // Variables: adoption, governance, gini
  // Uses sin() for peak friction at mid-transition. PI (not a decimal literal) so this
  // reproduces the hardcoded engine's Math.PI bit-for-bit (see simulation/pure.ts).
  displacementFriction: 'sin(adoption * PI) * 40 * pow(1 - governance, 1.5) * (1 + gini * 0.5)',

  // UBI utility conversion
  // Variables: ubi, utilityScale (gdpPerCapita/40 + 150)
  ubiUtility: '(ubi / utilityScale) * 120',

  // Gini dampening effect
  // Variables: gini
  giniDamping: '1.5 - gini',

  // Demand collapse projection
  // Variables: customerBaseWellbeing
  demandCollapse: 'customerBaseWellbeing < 40 ? min(0.8, (50 - customerBaseWellbeing) / 100) : 0',

  // Reputation change (simplified)
  // Variables: policyStance (encoded as number), contributionRate, avgContributionRate
  reputationChange: 'contributionRate > avgContributionRate ? 2 : (contributionRate < avgContributionRate * 0.5 ? -3 : 0)'
};

/**
 * DEFAULT_MODEL_CONFIG - The standard model as a ModelConfig object
 * This serves as a reference for users creating custom models
 */
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  id: 'standard-v1',
  name: 'Standard Economic Model',
  description: 'The default causal model implementing corporation-driven UBI with game theory dynamics. Balances displacement friction against UBI utility with governance-modulated effects.',

  parameters: [
    { name: 'aiGrowthRate', min: 0.01, max: 0.20, default: 0.08, description: 'Base AI adoption growth rate', unit: 'per month' },
    { name: 'displacementRate', min: 0.50, max: 0.95, default: 0.75, description: 'Labor income displaced at 100% AI adoption', unit: '%' },
    { name: 'gdpScaling', min: 0, max: 1, default: 0.4, description: 'How much GDP affects UBI utility (0=flat, 1=proportional)', unit: '' },
    { name: 'marketPressure', min: 0, max: 1, default: 0.5, description: 'How strongly demand affects corp decisions', unit: '' },
    { name: 'ubiBoostCoeff', min: 0.05, max: 0.40, default: 0.20, description: 'UBI boost coefficient for wellbeing', unit: '' },
    { name: 'frictionCoeff', min: 0.05, max: 0.30, default: 0.12, description: 'Displacement friction coefficient', unit: '' }
  ],

  equations: DEFAULT_EQUATIONS,

  metadata: {
    author: 'System',
    version: '1.0.0',
    createdAt: '2024-01-01T00:00:00Z',
    description: 'Built-in reference implementation based on corporation-centric UBI model',
    overridesStandardCausality: false,
    tags: ['reference', 'standard', 'balanced']
  }
};

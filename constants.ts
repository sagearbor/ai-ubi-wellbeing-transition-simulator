
import { ModelParameters, CountryStats, Corporation, ScenarioPreset } from './types';

// Helper to determine archetype based on GDP and governance
type Archetype = 'rich-democracy' | 'middle-stable' | 'developing-fragile' | 'authoritarian' | 'failed-state';
const getArchetype = (gdp: number, gov: number): Archetype => {
  if (gov < 0.35) return 'failed-state';
  if (gov < 0.50 && gdp > 5000) return 'authoritarian';
  if (gdp >= 35000 && gov >= 0.80) return 'rich-democracy';
  if (gdp >= 10000 && gov >= 0.60) return 'middle-stable';
  return 'developing-fragile';
};

export const PRESET_MODELS: ModelParameters[] = [
  {
    id: 'organic-incentive',
    name: 'Organic Incentive Model',
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
  }
];

// Base country data - will be enriched with computed fields
const COUNTRY_BASE_DATA = [
  // --- North America ---
  // id, name, pop, gdp, governance, gini
  { id: 'USA', name: 'United States', population: 331, gdpPerCapita: 63000, governance: 0.82, gini: 0.39 },
  { id: 'CAN', name: 'Canada', population: 38, gdpPerCapita: 43000, governance: 0.92, gini: 0.33 },
  { id: 'MEX', name: 'Mexico', population: 128, gdpPerCapita: 8300, governance: 0.55, gini: 0.45 },

  // --- Central America & Caribbean ---
  { id: 'GTM', name: 'Guatemala', population: 18, gdpPerCapita: 4600, governance: 0.40, gini: 0.48 },
  { id: 'CUB', name: 'Cuba', population: 11, gdpPerCapita: 8000, governance: 0.35, gini: 0.38 },
  { id: 'HTI', name: 'Haiti', population: 11.4, gdpPerCapita: 1200, governance: 0.18, gini: 0.41 },
  { id: 'DOM', name: 'Dominican Rep.', population: 10.8, gdpPerCapita: 8000, governance: 0.55, gini: 0.44 },
  { id: 'HND', name: 'Honduras', population: 9.9, gdpPerCapita: 2400, governance: 0.38, gini: 0.52 },
  { id: 'NIC', name: 'Nicaragua', population: 6.6, gdpPerCapita: 1900, governance: 0.32, gini: 0.46 },
  { id: 'SLV', name: 'El Salvador', population: 6.5, gdpPerCapita: 3800, governance: 0.48, gini: 0.40 },
  { id: 'CRI', name: 'Costa Rica', population: 5.1, gdpPerCapita: 12000, governance: 0.78, gini: 0.49 },
  { id: 'PAN', name: 'Panama', population: 4.3, gdpPerCapita: 15000, governance: 0.65, gini: 0.50 },
  { id: 'JAM', name: 'Jamaica', population: 2.9, gdpPerCapita: 4600, governance: 0.60, gini: 0.45 },
  { id: 'BLZ', name: 'Belize', population: 0.4, gdpPerCapita: 4400, governance: 0.55, gini: 0.53 },
  { id: 'BHS', name: 'Bahamas', population: 0.4, gdpPerCapita: 28000, governance: 0.78, gini: 0.43 },
  { id: 'TTO', name: 'Trinidad & Tobago', population: 1.4, gdpPerCapita: 15000, governance: 0.62, gini: 0.40 },

  // --- South America ---
  { id: 'BRA', name: 'Brazil', population: 212, gdpPerCapita: 6700, governance: 0.52, gini: 0.53 },
  { id: 'ARG', name: 'Argentina', population: 45, gdpPerCapita: 8400, governance: 0.58, gini: 0.42 },
  { id: 'COL', name: 'Colombia', population: 51, gdpPerCapita: 5300, governance: 0.55, gini: 0.51 },
  { id: 'CHL', name: 'Chile', population: 19, gdpPerCapita: 13000, governance: 0.78, gini: 0.45 },
  { id: 'PER', name: 'Peru', population: 33, gdpPerCapita: 6100, governance: 0.50, gini: 0.43 },
  { id: 'VEN', name: 'Venezuela', population: 28, gdpPerCapita: 3000, governance: 0.22, gini: 0.44 },
  { id: 'ECU', name: 'Ecuador', population: 17, gdpPerCapita: 5600, governance: 0.48, gini: 0.45 },
  { id: 'BOL', name: 'Bolivia', population: 12, gdpPerCapita: 3100, governance: 0.45, gini: 0.42 },
  { id: 'PRY', name: 'Paraguay', population: 7, gdpPerCapita: 5400, governance: 0.50, gini: 0.46 },
  { id: 'URY', name: 'Uruguay', population: 3.5, gdpPerCapita: 15000, governance: 0.82, gini: 0.40 },
  { id: 'GUY', name: 'Guyana', population: 0.8, gdpPerCapita: 9000, governance: 0.52, gini: 0.45 },
  { id: 'SUR', name: 'Suriname', population: 0.6, gdpPerCapita: 4700, governance: 0.52, gini: 0.57 },

  // --- Europe ---
  { id: 'RUS', name: 'Russia', population: 144, gdpPerCapita: 10000, governance: 0.35, gini: 0.36 },
  { id: 'GBR', name: 'United Kingdom', population: 67, gdpPerCapita: 41000, governance: 0.88, gini: 0.35 },
  { id: 'FRA', name: 'France', population: 67, gdpPerCapita: 39000, governance: 0.85, gini: 0.32 },
  { id: 'DEU', name: 'Germany', population: 83, gdpPerCapita: 46000, governance: 0.92, gini: 0.31 },
  { id: 'ITA', name: 'Italy', population: 60, gdpPerCapita: 31000, governance: 0.72, gini: 0.35 },
  { id: 'ESP', name: 'Spain', population: 47, gdpPerCapita: 27000, governance: 0.78, gini: 0.35 },
  { id: 'NLD', name: 'Netherlands', population: 17, gdpPerCapita: 52000, governance: 0.94, gini: 0.29 },
  { id: 'SWE', name: 'Sweden', population: 10, gdpPerCapita: 51000, governance: 0.96, gini: 0.28 },
  { id: 'BEL', name: 'Belgium', population: 11, gdpPerCapita: 45000, governance: 0.88, gini: 0.27 },
  { id: 'AUT', name: 'Austria', population: 9, gdpPerCapita: 48000, governance: 0.92, gini: 0.30 },
  { id: 'POL', name: 'Poland', population: 38, gdpPerCapita: 15600, governance: 0.72, gini: 0.30 },
  { id: 'NOR', name: 'Norway', population: 5, gdpPerCapita: 67000, governance: 0.98, gini: 0.27 },
  { id: 'CHE', name: 'Switzerland', population: 8, gdpPerCapita: 86000, governance: 0.96, gini: 0.33 },
  { id: 'IRL', name: 'Ireland', population: 5, gdpPerCapita: 83000, governance: 0.90, gini: 0.32 },
  { id: 'DNK', name: 'Denmark', population: 6, gdpPerCapita: 60000, governance: 0.96, gini: 0.28 },
  { id: 'FIN', name: 'Finland', population: 5.5, gdpPerCapita: 49000, governance: 0.96, gini: 0.27 },
  { id: 'PRT', name: 'Portugal', population: 10, gdpPerCapita: 23000, governance: 0.80, gini: 0.33 },
  { id: 'GRC', name: 'Greece', population: 10.5, gdpPerCapita: 18000, governance: 0.65, gini: 0.34 },
  { id: 'CZE', name: 'Czechia', population: 10.7, gdpPerCapita: 22000, governance: 0.82, gini: 0.25 },
  { id: 'HUN', name: 'Hungary', population: 9.7, gdpPerCapita: 16000, governance: 0.65, gini: 0.30 },
  { id: 'ROU', name: 'Romania', population: 19, gdpPerCapita: 13000, governance: 0.62, gini: 0.35 },
  { id: 'UKR', name: 'Ukraine', population: 44, gdpPerCapita: 3700, governance: 0.48, gini: 0.26 },
  { id: 'BLR', name: 'Belarus', population: 9.5, gdpPerCapita: 6400, governance: 0.28, gini: 0.25 },
  { id: 'SRB', name: 'Serbia', population: 7, gdpPerCapita: 7700, governance: 0.58, gini: 0.36 },
  { id: 'ISL', name: 'Iceland', population: 0.3, gdpPerCapita: 59000, governance: 0.95, gini: 0.26 },
  { id: 'EST', name: 'Estonia', population: 1.3, gdpPerCapita: 23000, governance: 0.88, gini: 0.31 },
  { id: 'LVA', name: 'Latvia', population: 1.9, gdpPerCapita: 18000, governance: 0.78, gini: 0.35 },
  { id: 'LTU', name: 'Lithuania', population: 2.8, gdpPerCapita: 20000, governance: 0.80, gini: 0.36 },
  { id: 'SVK', name: 'Slovakia', population: 5.4, gdpPerCapita: 19000, governance: 0.75, gini: 0.25 },
  { id: 'SVN', name: 'Slovenia', population: 2.1, gdpPerCapita: 25000, governance: 0.85, gini: 0.25 },
  { id: 'HRV', name: 'Croatia', population: 4.0, gdpPerCapita: 14000, governance: 0.68, gini: 0.30 },
  { id: 'BIH', name: 'Bosnia & Herz.', population: 3.3, gdpPerCapita: 6000, governance: 0.48, gini: 0.33 },
  { id: 'MNE', name: 'Montenegro', population: 0.6, gdpPerCapita: 7700, governance: 0.55, gini: 0.39 },
  { id: 'MKD', name: 'North Macedonia', population: 2.0, gdpPerCapita: 5900, governance: 0.55, gini: 0.33 },
  { id: 'ALB', name: 'Albania', population: 2.8, gdpPerCapita: 5200, governance: 0.52, gini: 0.33 },
  { id: 'BGR', name: 'Bulgaria', population: 6.9, gdpPerCapita: 10000, governance: 0.62, gini: 0.40 },
  { id: 'MDA', name: 'Moldova', population: 2.6, gdpPerCapita: 4500, governance: 0.48, gini: 0.26 },
  { id: 'LUX', name: 'Luxembourg', population: 0.6, gdpPerCapita: 115000, governance: 0.96, gini: 0.35 },
  { id: 'CYP', name: 'Cyprus', population: 1.2, gdpPerCapita: 26000, governance: 0.78, gini: 0.32 },
  { id: 'MLT', name: 'Malta', population: 0.5, gdpPerCapita: 29000, governance: 0.82, gini: 0.29 },

  // --- East & SE Asia ---
  { id: 'CHN', name: 'China', population: 1400, gdpPerCapita: 12500, governance: 0.45, gini: 0.38 },
  { id: 'JPN', name: 'Japan', population: 125, gdpPerCapita: 40000, governance: 0.88, gini: 0.33 },
  { id: 'KOR', name: 'South Korea', population: 51, gdpPerCapita: 31000, governance: 0.85, gini: 0.31 },
  { id: 'TWN', name: 'Taiwan', population: 23, gdpPerCapita: 33000, governance: 0.88, gini: 0.34 },
  { id: 'MNG', name: 'Mongolia', population: 3.3, gdpPerCapita: 4000, governance: 0.58, gini: 0.32 },
  { id: 'PRK', name: 'North Korea', population: 25, gdpPerCapita: 640, governance: 0.10, gini: 0.30 },
  { id: 'VNM', name: 'Vietnam', population: 97, gdpPerCapita: 2700, governance: 0.52, gini: 0.36 },
  { id: 'IDN', name: 'Indonesia', population: 273, gdpPerCapita: 3800, governance: 0.55, gini: 0.38 },
  { id: 'PHL', name: 'Philippines', population: 109, gdpPerCapita: 3200, governance: 0.52, gini: 0.44 },
  { id: 'THA', name: 'Thailand', population: 70, gdpPerCapita: 7100, governance: 0.55, gini: 0.36 },
  { id: 'MYS', name: 'Malaysia', population: 32, gdpPerCapita: 10400, governance: 0.68, gini: 0.41 },
  { id: 'SGP', name: 'Singapore', population: 5.7, gdpPerCapita: 65000, governance: 0.92, gini: 0.46 },
  { id: 'MMR', name: 'Myanmar', population: 54, gdpPerCapita: 1400, governance: 0.22, gini: 0.31 },
  { id: 'KHM', name: 'Cambodia', population: 16, gdpPerCapita: 1500, governance: 0.38, gini: 0.38 },
  { id: 'LAO', name: 'Laos', population: 7, gdpPerCapita: 2600, governance: 0.35, gini: 0.36 },
  { id: 'BRN', name: 'Brunei', population: 0.4, gdpPerCapita: 31000, governance: 0.70, gini: 0.35 },
  { id: 'TLS', name: 'Timor-Leste', population: 1.3, gdpPerCapita: 1300, governance: 0.42, gini: 0.29 },

  // --- South & Central Asia ---
  { id: 'IND', name: 'India', population: 1380, gdpPerCapita: 2100, governance: 0.55, gini: 0.35 },
  { id: 'PAK', name: 'Pakistan', population: 220, gdpPerCapita: 1100, governance: 0.35, gini: 0.30 },
  { id: 'BGD', name: 'Bangladesh', population: 164, gdpPerCapita: 1900, governance: 0.45, gini: 0.32 },
  { id: 'LKA', name: 'Sri Lanka', population: 21, gdpPerCapita: 3800, governance: 0.52, gini: 0.40 },
  { id: 'NPL', name: 'Nepal', population: 29, gdpPerCapita: 1100, governance: 0.45, gini: 0.33 },
  { id: 'BTN', name: 'Bhutan', population: 0.8, gdpPerCapita: 3000, governance: 0.65, gini: 0.37 },
  { id: 'MDV', name: 'Maldives', population: 0.5, gdpPerCapita: 10000, governance: 0.55, gini: 0.31 },
  { id: 'KAZ', name: 'Kazakhstan', population: 19, gdpPerCapita: 9000, governance: 0.48, gini: 0.28 },
  { id: 'UZB', name: 'Uzbekistan', population: 34, gdpPerCapita: 1700, governance: 0.38, gini: 0.35 },
  { id: 'TKM', name: 'Turkmenistan', population: 6, gdpPerCapita: 7600, governance: 0.18, gini: 0.41 },
  { id: 'KGZ', name: 'Kyrgyzstan', population: 6.5, gdpPerCapita: 1100, governance: 0.45, gini: 0.29 },
  { id: 'TJK', name: 'Tajikistan', population: 9.5, gdpPerCapita: 850, governance: 0.32, gini: 0.34 },

  // --- Middle East / West Asia ---
  { id: 'TUR', name: 'Turkey', population: 84, gdpPerCapita: 8500, governance: 0.48, gini: 0.42 },
  { id: 'SAU', name: 'Saudi Arabia', population: 34, gdpPerCapita: 20000, governance: 0.48, gini: 0.45 },
  { id: 'IRN', name: 'Iran', population: 83, gdpPerCapita: 5400, governance: 0.32, gini: 0.40 },
  { id: 'IRQ', name: 'Iraq', population: 40, gdpPerCapita: 4200, governance: 0.28, gini: 0.30 },
  { id: 'AFG', name: 'Afghanistan', population: 39, gdpPerCapita: 500, governance: 0.15, gini: 0.30 },
  { id: 'ARE', name: 'UAE', population: 10, gdpPerCapita: 40000, governance: 0.78, gini: 0.32 },
  { id: 'ISR', name: 'Israel', population: 9, gdpPerCapita: 43000, governance: 0.82, gini: 0.39 },
  { id: 'JOR', name: 'Jordan', population: 10, gdpPerCapita: 4200, governance: 0.58, gini: 0.34 },
  { id: 'LBN', name: 'Lebanon', population: 6.8, gdpPerCapita: 4000, governance: 0.30, gini: 0.32 },
  { id: 'SYR', name: 'Syria', population: 17, gdpPerCapita: 1000, governance: 0.15, gini: 0.35 },
  { id: 'YEM', name: 'Yemen', population: 30, gdpPerCapita: 800, governance: 0.12, gini: 0.37 },
  { id: 'OMN', name: 'Oman', population: 5, gdpPerCapita: 15000, governance: 0.68, gini: 0.40 },
  { id: 'QAT', name: 'Qatar', population: 2.8, gdpPerCapita: 60000, governance: 0.72, gini: 0.41 },
  { id: 'KWT', name: 'Kuwait', population: 4.2, gdpPerCapita: 27000, governance: 0.62, gini: 0.40 },
  { id: 'BHR', name: 'Bahrain', population: 1.7, gdpPerCapita: 23000, governance: 0.58, gini: 0.42 },
  { id: 'AZE', name: 'Azerbaijan', population: 10, gdpPerCapita: 4200, governance: 0.38, gini: 0.26 },
  { id: 'GEO', name: 'Georgia', population: 3.7, gdpPerCapita: 4300, governance: 0.65, gini: 0.35 },
  { id: 'ARM', name: 'Armenia', population: 3, gdpPerCapita: 4200, governance: 0.55, gini: 0.30 },
  { id: 'PSE', name: 'Palestine', population: 5, gdpPerCapita: 3000, governance: 0.35, gini: 0.34 },

  // --- Africa ---
  { id: 'NGA', name: 'Nigeria', population: 206, gdpPerCapita: 2000, governance: 0.32, gini: 0.35 },
  { id: 'ZAF', name: 'South Africa', population: 59, gdpPerCapita: 5000, governance: 0.58, gini: 0.63 },
  { id: 'EGY', name: 'Egypt', population: 102, gdpPerCapita: 3500, governance: 0.38, gini: 0.32 },
  { id: 'ETH', name: 'Ethiopia', population: 114, gdpPerCapita: 850, governance: 0.35, gini: 0.35 },
  { id: 'KEN', name: 'Kenya', population: 53, gdpPerCapita: 1800, governance: 0.52, gini: 0.41 },
  { id: 'COD', name: 'DR Congo', population: 89, gdpPerCapita: 550, governance: 0.18, gini: 0.42 },
  { id: 'MAR', name: 'Morocco', population: 37, gdpPerCapita: 3000, governance: 0.55, gini: 0.40 },
  { id: 'DZA', name: 'Algeria', population: 44, gdpPerCapita: 3300, governance: 0.38, gini: 0.28 },
  { id: 'AGO', name: 'Angola', population: 33, gdpPerCapita: 1800, governance: 0.28, gini: 0.51 },

  // --- Oceania ---
  { id: 'AUS', name: 'Australia', population: 25, gdpPerCapita: 51000, governance: 0.92, gini: 0.34 },
  { id: 'NZL', name: 'New Zealand', population: 5, gdpPerCapita: 42000, governance: 0.95, gini: 0.32 },
  { id: 'PNG', name: 'Papua New Guinea', population: 9, gdpPerCapita: 2600, governance: 0.38, gini: 0.42 }
];

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

// Enrich base data with computed fields (without corporation relationships - those are added later)
const INITIAL_COUNTRIES_BASE = COUNTRY_BASE_DATA.map(c => {
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
});

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

// Now that INITIAL_CORPORATIONS is defined, populate corporation relationships in countries
export const INITIAL_COUNTRIES = INITIAL_COUNTRIES_BASE.map(c => ({
  ...c,
  headquarteredCorps: getHeadquarteredCorps(c.id, INITIAL_CORPORATIONS),
  customerOfCorps: getCustomerOfCorps(c.id, INITIAL_CORPORATIONS)
}));

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

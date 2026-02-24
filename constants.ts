
import { ModelParameters, CountryStats } from './types';

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
    globalRedistributionRate: 0.1 // 10% global tax
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
    globalRedistributionRate: 0.2
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
    globalRedistributionRate: 0.05
  }
];

// Helper to expand the previous simple objects into the new robust CountryStats
const mk = (
  id: string, name: string, pop: number, gdp: number, 
  res: number, gini: number, gov: number, corr: number, wb: number
): Partial<CountryStats> => ({
  id, name, population: pop, gdpPerCapita: gdp, socialResilience: res,
  gini, governance: gov, corruption: corr, aiAdoption: 0.02, wellbeing: wb, companiesJoined: 0
});

// Wellbeing Estimates (0-100) based on HDI and Social Progress Index
export const INITIAL_COUNTRIES: Partial<CountryStats>[] = [
  // --- North America ---
  mk('USA', 'United States', 331, 63000, 0.75, 0.48, 0.8, 0.3, 78),
  mk('CAN', 'Canada', 38, 43000, 0.85, 0.33, 0.9, 0.2, 85),
  mk('MEX', 'Mexico', 128, 8300, 0.55, 0.45, 0.5, 0.6, 60),

  // --- Central America & Caribbean ---
  mk('GTM', 'Guatemala', 18, 4600, 0.45, 0.48, 0.4, 0.7, 45),
  mk('CUB', 'Cuba', 11, 8000, 0.65, 0.38, 0.2, 0.5, 55),
  mk('HTI', 'Haiti', 11.4, 1200, 0.20, 0.60, 0.1, 0.9, 25), // Failed state
  mk('DOM', 'Dominican Rep.', 10.8, 8000, 0.55, 0.42, 0.6, 0.6, 58),
  mk('HND', 'Honduras', 9.9, 2400, 0.40, 0.52, 0.4, 0.7, 40),
  mk('SLV', 'El Salvador', 6.5, 3800, 0.50, 0.40, 0.4, 0.6, 50),
  mk('CRI', 'Costa Rica', 5.1, 12000, 0.75, 0.48, 0.8, 0.4, 70),
  mk('PAN', 'Panama', 4.3, 15000, 0.70, 0.50, 0.7, 0.5, 65),
  
  // --- South America ---
  mk('BRA', 'Brazil', 212, 6700, 0.50, 0.53, 0.6, 0.6, 55),
  mk('ARG', 'Argentina', 45, 8400, 0.40, 0.42, 0.6, 0.6, 58),
  mk('COL', 'Colombia', 51, 5300, 0.55, 0.51, 0.6, 0.6, 52),
  mk('CHL', 'Chile', 19, 13000, 0.70, 0.44, 0.8, 0.3, 70),
  mk('VEN', 'Venezuela', 28, 3000, 0.25, 0.48, 0.1, 0.9, 30),
  mk('PER', 'Peru', 33, 6100, 0.50, 0.43, 0.5, 0.6, 54),
  mk('URY', 'Uruguay', 3.5, 15000, 0.80, 0.40, 0.9, 0.2, 72),

  // --- Europe ---
  mk('RUS', 'Russia', 144, 10000, 0.40, 0.38, 0.1, 0.8, 50),
  mk('GBR', 'United Kingdom', 67, 41000, 0.70, 0.35, 0.8, 0.2, 82),
  mk('FRA', 'France', 67, 39000, 0.80, 0.32, 0.8, 0.2, 81),
  mk('DEU', 'Germany', 83, 46000, 0.90, 0.31, 0.9, 0.1, 84),
  mk('ITA', 'Italy', 60, 31000, 0.65, 0.35, 0.7, 0.4, 76),
  mk('ESP', 'Spain', 47, 27000, 0.70, 0.34, 0.8, 0.3, 78),
  mk('NLD', 'Netherlands', 17, 52000, 0.92, 0.28, 0.9, 0.1, 88),
  mk('SWE', 'Sweden', 10, 51000, 0.95, 0.27, 0.95, 0.05, 90),
  mk('NOR', 'Norway', 5, 67000, 0.98, 0.26, 0.95, 0.05, 92),
  mk('POL', 'Poland', 38, 15600, 0.75, 0.30, 0.6, 0.4, 68),
  mk('UKR', 'Ukraine', 44, 3700, 0.60, 0.26, 0.5, 0.7, 45),
  mk('CHE', 'Switzerland', 8, 86000, 0.95, 0.32, 0.95, 0.1, 91),

  // --- Asia ---
  mk('CHN', 'China', 1400, 12500, 0.70, 0.38, 0.1, 0.5, 65),
  mk('JPN', 'Japan', 125, 40000, 0.85, 0.32, 0.8, 0.1, 84),
  mk('KOR', 'South Korea', 51, 31000, 0.80, 0.31, 0.8, 0.3, 80),
  mk('IND', 'India', 1380, 2100, 0.55, 0.35, 0.6, 0.5, 48),
  mk('PAK', 'Pakistan', 220, 1100, 0.35, 0.30, 0.4, 0.7, 35),
  mk('IDN', 'Indonesia', 273, 3800, 0.60, 0.37, 0.5, 0.6, 52),
  mk('VNM', 'Vietnam', 97, 2700, 0.75, 0.36, 0.2, 0.6, 55),
  mk('PRK', 'North Korea', 25, 640, 0.15, 0.30, 0.0, 0.9, 15),
  mk('SGP', 'Singapore', 5.7, 65000, 0.90, 0.45, 0.4, 0.1, 88),
  mk('AFG', 'Afghanistan', 39, 500, 0.20, 0.30, 0.1, 0.9, 10),

  // --- Middle East ---
  mk('TUR', 'Turkey', 84, 8500, 0.45, 0.42, 0.3, 0.6, 58),
  mk('SAU', 'Saudi Arabia', 34, 20000, 0.75, 0.45, 0.1, 0.4, 65),
  mk('IRN', 'Iran', 83, 5400, 0.45, 0.40, 0.2, 0.7, 45),
  mk('ISR', 'Israel', 9, 43000, 0.80, 0.38, 0.7, 0.3, 79),
  mk('ARE', 'UAE', 10, 40000, 0.85, 0.26, 0.2, 0.2, 75),

  // --- Africa ---
  mk('NGA', 'Nigeria', 206, 2000, 0.35, 0.35, 0.5, 0.8, 38),
  mk('ZAF', 'South Africa', 59, 5000, 0.40, 0.63, 0.6, 0.5, 45),
  mk('EGY', 'Egypt', 102, 3500, 0.45, 0.31, 0.2, 0.6, 48),
  mk('ETH', 'Ethiopia', 114, 850, 0.40, 0.35, 0.3, 0.6, 30),
  mk('COD', 'DR Congo', 89, 550, 0.20, 0.42, 0.2, 0.9, 15),

  // --- Oceania ---
  mk('AUS', 'Australia', 25, 51000, 0.90, 0.34, 0.9, 0.1, 86),
  mk('NZL', 'New Zealand', 5, 42000, 0.95, 0.32, 0.95, 0.05, 88)
];

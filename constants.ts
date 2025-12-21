
import { ModelParameters } from './types';

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
    gdpScaling: 0.4
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
    gdpScaling: 0.7
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
    gdpScaling: 0.2
  }
];

export const INITIAL_COUNTRIES = [
  // North America
  { id: 'USA', name: 'United States', population: 331, gdpPerCapita: 63000, socialResilience: 0.75 },
  { id: 'CAN', name: 'Canada', population: 38, gdpPerCapita: 43000, socialResilience: 0.85 },
  { id: 'MEX', name: 'Mexico', population: 128, gdpPerCapita: 8300, socialResilience: 0.55 },
  // Europe
  { id: 'GBR', name: 'United Kingdom', population: 67, gdpPerCapita: 41000, socialResilience: 0.70 },
  { id: 'FRA', name: 'France', population: 67, gdpPerCapita: 39000, socialResilience: 0.80 },
  { id: 'DEU', name: 'Germany', population: 83, gdpPerCapita: 46000, socialResilience: 0.90 },
  { id: 'ITA', name: 'Italy', population: 60, gdpPerCapita: 31000, socialResilience: 0.65 },
  { id: 'ESP', name: 'Spain', population: 47, gdpPerCapita: 27000, socialResilience: 0.70 },
  { id: 'NOR', name: 'Norway', population: 5, gdpPerCapita: 67000, socialResilience: 0.98 },
  { id: 'CHE', name: 'Switzerland', population: 8, gdpPerCapita: 86000, socialResilience: 0.95 },
  { id: 'POL', name: 'Poland', population: 38, gdpPerCapita: 15600, socialResilience: 0.75 },
  { id: 'UKR', name: 'Ukraine', population: 44, gdpPerCapita: 3700, socialResilience: 0.60 },
  // Asia
  { id: 'CHN', name: 'China', population: 1400, gdpPerCapita: 12500, socialResilience: 0.70 },
  { id: 'IND', name: 'India', population: 1380, gdpPerCapita: 2100, socialResilience: 0.55 },
  { id: 'JPN', name: 'Japan', population: 125, gdpPerCapita: 40000, socialResilience: 0.85 },
  { id: 'KOR', name: 'South Korea', population: 51, gdpPerCapita: 31000, socialResilience: 0.80 },
  { id: 'VNM', name: 'Vietnam', population: 97, gdpPerCapita: 2700, socialResilience: 0.75 },
  { id: 'IDN', name: 'Indonesia', population: 273, gdpPerCapita: 3800, socialResilience: 0.60 },
  { id: 'PAK', name: 'Pakistan', population: 220, gdpPerCapita: 1100, socialResilience: 0.35 },
  { id: 'BGD', name: 'Bangladesh', population: 164, gdpPerCapita: 1900, socialResilience: 0.50 },
  { id: 'PHL', name: 'Philippines', population: 109, gdpPerCapita: 3200, socialResilience: 0.60 },
  { id: 'TUR', name: 'Turkey', population: 84, gdpPerCapita: 8500, socialResilience: 0.45 },
  { id: 'RUS', name: 'Russia', population: 144, gdpPerCapita: 10000, socialResilience: 0.40 },
  // Middle East
  { id: 'SAU', name: 'Saudi Arabia', population: 34, gdpPerCapita: 20000, socialResilience: 0.75 },
  { id: 'IRN', name: 'Iran', population: 83, gdpPerCapita: 5400, socialResilience: 0.45 },
  { id: 'ISR', name: 'Israel', population: 9, gdpPerCapita: 43000, socialResilience: 0.80 },
  { id: 'PSE', name: 'Palestine', population: 5, gdpPerCapita: 3500, socialResilience: 0.30 },
  // Africa
  { id: 'NGA', name: 'Nigeria', population: 206, gdpPerCapita: 2000, socialResilience: 0.35 },
  { id: 'ZAF', name: 'South Africa', population: 59, gdpPerCapita: 5000, socialResilience: 0.40 },
  { id: 'EGY', name: 'Egypt', population: 102, gdpPerCapita: 3500, socialResilience: 0.45 },
  { id: 'ETH', name: 'Ethiopia', population: 114, gdpPerCapita: 850, socialResilience: 0.40 },
  { id: 'KEN', name: 'Kenya', population: 53, gdpPerCapita: 1800, socialResilience: 0.55 },
  { id: 'COD', name: 'DR Congo', population: 89, gdpPerCapita: 550, socialResilience: 0.20 },
  // South America & Oceania
  { id: 'BRA', name: 'Brazil', population: 212, gdpPerCapita: 6700, socialResilience: 0.50 },
  { id: 'ARG', name: 'Argentina', population: 45, gdpPerCapita: 8400, socialResilience: 0.40 },
  { id: 'COL', name: 'Colombia', population: 51, gdpPerCapita: 5300, socialResilience: 0.55 },
  { id: 'AUS', name: 'Australia', population: 25, gdpPerCapita: 51000, socialResilience: 0.90 },
  { id: 'NZL', name: 'New Zealand', population: 5, gdpPerCapita: 42000, socialResilience: 0.95 }
];

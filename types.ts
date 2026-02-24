
export interface ModelParameters {
  id: string;
  name: string;
  description: string;
  corporateTaxRate: number;
  adoptionIncentive: number;
  baseUBI: number;
  aiGrowthRate: number;
  volatility: number;
  gdpScaling: number; // 0 = Flat UBI, 1 = Highly skewed to GDP
  globalRedistributionRate: number; // 0 = All tax stays local, 1 = All tax goes to UN
  isCustom?: boolean;
}

export interface SimulationState {
  month: number;
  globalFund: number; // The pool of money shared globally
  averageWellbeing: number;
  shadowAverageWellbeing: number; // The "Ghost" baseline (No UBI)
  totalAiCompanies: number;
  countryData: Record<string, CountryStats>;
}

export interface CountryStats {
  id: string;
  name: string;
  population: number;
  gdpPerCapita: number;
  
  // Dynamic Sim State
  aiAdoption: number; // 0 to 1
  wellbeing: number; // 0 to 100
  companiesJoined: number;
  
  // Socio-Political DNA
  socialResilience: number; // 0 to 1 (General buffer)
  gini: number; // 0 (Perfect Equality) to 1 (Perfect Inequality)
  governance: number; // 0 (Authoritarian) to 1 (Democracy)
  corruption: number; // 0 (Honest) to 1 (Kleptocracy) - Dynamic
  
  // Derived
  localFundAccumulated?: number; // Debugging/Vis
}

export interface HistoryPoint {
  month: number;
  state: SimulationState;
}

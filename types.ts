
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
  isCustom?: boolean;
}

export interface SimulationState {
  month: number;
  globalFund: number;
  averageWellbeing: number;
  totalAiCompanies: number;
  countryData: Record<string, CountryStats>;
}

export interface CountryStats {
  id: string;
  name: string;
  population: number;
  aiAdoption: number; // 0 to 1
  gdpPerCapita: number;
  wellbeing: number; // 0 to 100
  companiesJoined: number;
  socialResilience: number; // 0 to 1, affects how displacement impacts wellbeing
}

export interface HistoryPoint {
  month: number;
  state: SimulationState;
}

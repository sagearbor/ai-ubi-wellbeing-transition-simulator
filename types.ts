
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
  globalRedistributionRate: number; // 0-1, % of fund distributed globally vs locally
  displacementRate: number; // 0.5-0.95, how much labor income displaced at 100% AI adoption
  directToWalletEnabled: boolean; // if true, global UBI bypasses corruption (blockchain/digital identity)

  // Corporation-centric model parameters
  defaultCorpPolicy: 'free-market' | 'selfish-start' | 'altruistic-start' | 'mixed-reality'; // Default policy stance for corporations
  marketPressure: number; // 0-1, how strongly demand affects corp decisions

  isCustom?: boolean;
}

export interface SimulationState {
  month: number;
  globalFund: number;
  averageWellbeing: number;
  totalAiCompanies: number;
  countryData: Record<string, CountryStats>;

  // Shadow/counterfactual tracking for impact analysis
  shadowCountryData: Record<string, CountryStats>; // Parallel "no intervention" simulation for comparison
  globalDisplacementGap: number; // Aggregate displacement gap across all countries (total displaced - total receiving UBI)
  corruptionLeakage: number; // Total dollars lost to corruption this month
  countriesInCrisis: number; // Count of countries where displacement exceeds UBI coverage
}

export interface CountryStats {
  id: string;
  name: string;
  population: number;
  aiAdoption: number; // 0 to 1
  gdpPerCapita: number;
  wellbeing: number; // 0 to 100
  companiesJoined: number;
  socialResilience: number; // 0 to 1, affects how displacement impacts wellbeing (kept for backwards compatibility)
  gini: number; // 0.2-0.7, inequality coefficient (World Bank Gini)
  governance: number; // 0.0-1.0, institutional quality (keep socialResilience for backwards compat)
  corruption: number; // 0.0-1.0, derived as 1 - governance
  archetype: 'rich-democracy' | 'middle-stable' | 'developing-fragile' | 'authoritarian' | 'failed-state'; // country classification
  participatesInGlobalUBI: boolean; // default true, corps/countries can opt out
  displacementGap?: number; // calculated during simulation, tracks crisis level

  // Corporation relationship (countries are RECIPIENTS and MARKETS, not policy-makers)
  headquarteredCorps: string[];     // Corp IDs with HQ here
  customerOfCorps: string[];        // Corp IDs that sell here (have this country in operatingCountries)

  // UBI receipt tracking (countries RECEIVE, don't control)
  ubiReceivedGlobal: number;        // From global ledger
  ubiReceivedLocal: number;         // From HQ-local corps
  ubiReceivedCustomerWeighted: number; // From customer-weighted corps
  totalUbiReceived: number;

  // Nation-level policy (limited influence - what countries CAN still control)
  nationalPolicy: {
    allowsDirectWallet: boolean;    // Can they block crypto? (false = authoritarian)
    localTaxOnUbi: number;          // Do they tax UBI income? (0-0.3)
    corporateIncentives: number;    // Tax breaks to attract AI HQs (0-0.5)
  };

  // Wellbeing trend for adaptive mechanisms
  wellbeingTrend: number[];         // Rolling window of last 6 months
}

export interface HistoryPoint {
  month: number;
  state: SimulationState;
}

export interface Corporation {
  id: string;
  name: string;
  headquartersCountry: string;      // ISO code where HQ is located
  operatingCountries: string[];     // ISO codes where they have customers/operations

  // Financial metrics
  aiRevenue: number;                // Revenue from AI automation (billions USD)
  aiAdoptionLevel: number;          // 0-1, how automated they are
  marketCap: number;                // Company size (billions USD)

  // UBI Contribution Policy (CORPORATION DECIDES, not nation)
  contributionRate: number;         // 0-1, % of AI revenue to UBI fund
  distributionStrategy: 'global' | 'customer-weighted' | 'hq-local';
  // global = distribute to all humans equally
  // customer-weighted = distribute proportional to where customers are
  // hq-local = contribute to HQ country only

  // Game theory state
  policyStance: 'generous' | 'moderate' | 'selfish';
  reputationScore: number;          // 0-100, affects customer preference
  lastPolicyChange?: number;

  // Derived metrics (calculated during simulation)
  customerBaseWellbeing?: number;   // Avg wellbeing of their customer countries
  projectedDemandCollapse?: number; // If customers can't afford products (0-1)
}

/**
 * CorporationPolicy - configurable policy settings for corporations.
 * Defines how a corporation contributes to UBI and responds to market conditions.
 * Supports both manual policy setting and adaptive/autonomous behavior.
 */
export interface CorporationPolicy {
  // Basic contribution settings
  contributionRate: number;         // 0.05 to 0.50 (5% to 50%)
  distributionStrategy: 'global' | 'customer-weighted' | 'hq-local';

  // Adaptive triggers
  adaptivePolicyEnabled: boolean;
  demandCollapseThreshold: number;  // If projected collapse > X%, increase contribution
  reputationMinimum: number;        // Minimum reputation to maintain

  // Response to market conditions
  followLeaderBehavior: boolean;    // Copy what market leaders do
  competitorAwareness: boolean;     // React to competitor policies
}

// GlobalLedger: Blockchain-based decentralized fund that NO NATION controls
// KEY DESIGN PRINCIPLE: Direct-to-wallet is ALWAYS true (blockchain infrastructure)
// Funds go directly to citizens' wallets - no corruption possible
export interface GlobalLedger {
  totalFunds: number;
  monthlyInflow: number;
  monthlyOutflow: number;

  // Distribution tracking
  fundsPerCapita: number;           // Global average per person
  fundsByCountry: Record<string, number>;  // How much each country's citizens receive

  // Transparency metrics (blockchain = fully transparent)
  contributorBreakdown: Record<string, number>;  // Which corps contributed what
  distributionBreakdown: Record<string, number>; // Where funds went

  // No corruption possible - direct to wallet
  corruptionLeakage: 0;             // Always 0 with blockchain - hardcoded as literal type
}

/**
 * GameTheoryState - tracks prisoner's dilemma dynamics in corporate UBI contributions.
 * Detects race-to-bottom vs virtuous cycle scenarios.
 */
export interface GameTheoryState {
  isInPrisonersDilemma: boolean;    // True when defection pressure high but cooperation low
  defectionCount: number;            // Corps that went selfish
  cooperationCount: number;          // Corps that stayed generous
  moderateCount: number;             // Corps in moderate stance
  raceToBottomRisk: number;          // 0-1, how close to mass defection
  virtuousCycleStrength: number;     // 0-1, how strong cooperation is
  avgContributionRate: number;       // Average across all corps
}

/**
 * SavedState - complete snapshot of the simulation for save/load functionality.
 * Stores all state needed to restore a simulation to a specific point in time.
 */
export interface SavedState {
  version: string;                   // Save file version for future compatibility
  timestamp: number;                 // Unix timestamp when saved
  month: number;                     // Current simulation month
  corporations: Corporation[];       // All corporation states
  countryData: Record<string, CountryStats>;  // All country states
  globalLedger: GlobalLedger;        // Global UBI fund state
  gameTheoryState: GameTheoryState;  // Game theory metrics
  model: ModelParameters;            // Current model configuration
  history: HistoryPoint[];           // Historical data points for charts
}

/**
 * ScenarioPreset - pre-configured scenarios for testing different economic models.
 * Each preset defines initial corporation policies and model parameters.
 */
export interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  modelParams: Partial<ModelParameters>;
  corporationOverrides?: {
    filter: (corp: Corporation) => boolean;
    updates: Partial<Corporation>;
  }[];
}

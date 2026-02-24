
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

/**
 * SelectedEntity - unified selection state for both corporations and countries.
 * Used to track which entity (if any) is currently selected in the UI.
 */
export type SelectedEntity =
  | { type: 'corporation'; id: string }
  | { type: 'country'; id: string }
  | null;

/**
 * ModelConfig - User-uploadable economic model configuration
 * Defines custom equations and parameters for simulation
 */

/** Individual parameter definition for a custom model */
export interface ParameterConfig {
  name: string;
  min: number;
  max: number;
  default: number;
  description: string;
  unit?: string; // e.g., '%', 'USD', 'months'
}

/** Set of equations that define the economic model */
export interface EquationSet {
  // Core simulation equations
  aiAdoptionGrowth: string;      // How AI adoption spreads (e.g., "aiGrowthRate * (1 + gdpPerCapita/100000) * (1 - adoption)")
  surplusGeneration: string;     // How corporations generate surplus (e.g., "aiRevenue * contributionRate")
  wellbeingDelta: string;        // How wellbeing changes (e.g., "ubiBoost * 0.20 - displacementFriction * 0.12")
  displacementFriction: string;  // How displacement affects wellbeing (e.g., "sin(adoption * PI) * baseFriction")
  ubiUtility: string;            // How UBI converts to utility (e.g., "(ubi / utilityScale) * 120")

  // Optional advanced equations
  demandCollapse?: string;       // Customer purchasing power projection
  reputationChange?: string;     // Corporation reputation dynamics
  giniDamping?: string;          // Inequality effect on UBI utility
}

/** Metadata about the model */
export interface ModelMetadata {
  author: string;
  version: string;
  createdAt: string;
  description: string;
  overridesStandardCausality: boolean;  // If true, model intentionally deviates from expected causal relationships
  justification?: string;                // Required if overridesStandardCausality is true
  tags?: string[];                       // e.g., ['optimistic', 'heterodox', 'experimental']
}

/** Complete model configuration */
export interface ModelConfig {
  id: string;
  name: string;
  description: string;

  // Parameters (can extend or override ModelParameters)
  parameters: ParameterConfig[];

  // Equations defining the model behavior
  equations: EquationSet;

  // Metadata
  metadata: ModelMetadata;
}

/** Result of validating a model configuration */
export interface ModelValidationResult {
  valid: boolean;
  tier1Passed: boolean;  // Sanity checks (bounds, money conservation, no NaN)
  tier2Score: number;    // Anchor tests passed (0-6)
  tier2Total: number;    // Total anchor tests (6)
  failures: ValidationFailure[];
  warnings: string[];
  complexity: number;    // Lower is better (Occam's razor)
}

/** Individual validation failure */
export interface ValidationFailure {
  testId: string;
  testName: string;
  category: 'sanity' | 'causal' | 'equilibrium' | 'consistency';
  reason: string;
  expected?: string;
  actual?: string;
}

/** Anchor test definition (for Phase 8-T7) */
export interface AnchorTest {
  id: string;
  name: string;
  category: 'causal' | 'equilibrium' | 'consistency';
  description: string;
  simulationMonths: number;
  setup: AnchorTestSetup;
  assert: AnchorTestAssertion;
}

export interface AnchorTestSetup {
  displacementRate?: number;
  allCorpsContributionRate?: number;
  allCorpsPolicyStance?: 'generous' | 'moderate' | 'selfish';
  distributionStrategy?: 'global' | 'customer-weighted' | 'hq-local';
  marketPressure?: number;
  compareStrategies?: string[];  // For comparison tests
  anyValidConfiguration?: boolean;
}

export interface AnchorTestAssertion {
  type: 'wellbeingDelta' | 'threshold' | 'comparison' | 'conservation' | 'gameTheory';
  operator?: '<' | '>' | '<=' | '>=' | '==' | 'within';
  value?: number;
  tolerance?: number;
}

// ============================================================================
// PHASE 9: MODEL STORAGE & LEADERBOARD TYPES
// ============================================================================

/**
 * StoredModel - A model saved to the leaderboard storage
 * Includes the model config plus validation results and metadata
 */
export interface StoredModel {
  id: string;                        // UUID
  modelConfig: ModelConfig;          // The actual model

  // Validation results (cached from when model was submitted)
  anchorTestsPassed: number;         // 0-6
  anchorTestResults: AnchorTestResult[];  // Detailed results
  complexity: number;                // Complexity score (lower = better)

  // Submission metadata
  submittedAt: string;               // ISO timestamp
  updatedAt: string;                 // ISO timestamp
  isPublic: boolean;                 // Show on leaderboard?

  // Aggregate run statistics
  runCount: number;                  // How many times this model has been run
  avgWellbeing: number;              // Average final wellbeing across runs
  avgFundSize: number;               // Average final fund size across runs

  // Community feedback
  rating: number;                    // 1-5 stars average
  ratingCount: number;               // Number of ratings
  flagCount: number;                 // Number of "broken" flags
}

/**
 * AnchorTestResult - Result of a single anchor test
 */
export interface AnchorTestResult {
  testId: string;
  testName: string;
  category: 'causal' | 'equilibrium' | 'consistency';
  passed: boolean;
  reason: string;
  details?: {
    expected: string;
    actual: string;
    metrics?: Record<string, number>;
  };
}

/**
 * RunRecord - Record of a single simulation run with a model
 */
export interface RunRecord {
  id: string;                        // UUID
  modelId: string;                   // Which model was used
  runAt: string;                     // ISO timestamp

  // Simulation results at month 60
  finalMonth: number;                // Usually 60
  finalWellbeing: number;            // Global average wellbeing
  finalFundSize: number;             // Global fund total
  countriesInCrisis: number;         // Count at end

  // Game theory outcome
  gameTheoryOutcome: 'virtuous-cycle' | 'prisoners-dilemma' | 'race-to-bottom' | 'mixed';
  avgContributionRate: number;       // Final average contribution

  // Model parameters used (snapshot)
  modelName: string;
  modelVersion: string;
}

/**
 * LeaderboardEntry - Simplified view for leaderboard display
 */
export interface LeaderboardEntry {
  rank: number;                      // Calculated rank (by complexity among eligible)
  modelId: string;
  modelName: string;
  author: string;

  // Validation
  anchorsPassed: number;             // X/6
  anchorsTotal: number;              // 6
  isEligible: boolean;               // anchorsPassed >= 4

  // Ranking score
  complexity: number;                // Lower = better = higher rank

  // Display metrics (not used for ranking)
  avgWellbeing: number;
  runCount: number;
  rating: number;

  // Metadata
  submittedAt: string;
}

/**
 * LeaderboardFilter - Filter options for leaderboard queries
 */
export interface LeaderboardFilter {
  minAnchorsPassed?: number;         // e.g., 6 for "perfect only"
  author?: string;                   // Filter by author
  tags?: string[];                   // Filter by tags
  onlyEligible?: boolean;            // Only show eligible models (4+ anchors)
}

/**
 * LeaderboardSort - Sort options
 */
export type LeaderboardSort =
  | 'rank'           // Default: by complexity (lower = higher rank)
  | 'newest'         // By submission date
  | 'mostRuns'       // By run count
  | 'highestRating'  // By community rating
  | 'bestWellbeing'; // By average wellbeing (display only)

/**
 * ModelRating - A single rating from a user
 */
export interface ModelRating {
  modelId: string;
  rating: number;                    // 1-5
  comment?: string;
  ratedAt: string;
  isFlagged: boolean;                // User flagged as broken
}

/**
 * StorageStats - Storage usage statistics
 */
export interface StorageStats {
  modelCount: number;
  runCount: number;
  storageUsedBytes: number;
  maxModels: number;                 // 50
  maxRunsPerModel: number;           // 100
}

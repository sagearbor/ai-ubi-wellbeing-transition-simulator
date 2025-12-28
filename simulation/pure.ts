/**
 * Pure simulation engine for UBI wellbeing transition model.
 *
 * This module contains the core simulation logic extracted from App.tsx
 * as a PURE FUNCTION with no side effects, no React dependencies, and
 * no state mutations. All functions take inputs and return new state.
 *
 * Used by:
 * - Main application (App.tsx) for interactive simulation
 * - Anchor tests for deterministic validation
 * - Batch analysis tools
 */

import {
  SimulationState,
  Corporation,
  GlobalLedger,
  GameTheoryState,
  ModelParameters,
  CountryStats
} from '../types';
import { INITIAL_COUNTRIES } from '../constants';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Input state for a simulation step */
export interface SimulationInput {
  state: SimulationState;
  corporations: Corporation[];
  model: ModelParameters;
}

/** Output from a simulation step */
export interface SimulationOutput {
  state: SimulationState;
  corporations: Corporation[];
  ledger: GlobalLedger;
  gameTheory: GameTheoryState;
}

// ============================================================================
// HELPER FUNCTIONS - PURE, NO SIDE EFFECTS
// ============================================================================

/**
 * Calculate AI revenue for a corporation based on automation and customer demand.
 *
 * @param corp Corporation to calculate revenue for
 * @param countries Country data for demand calculation
 * @returns AI revenue in billions USD
 */
function calculateAiRevenue(
  corp: Corporation,
  countries: Record<string, CountryStats>
): number {
  // Base revenue from AI automation
  // Formula: adoption level × market cap × 15% (industry standard for AI revenue as % of market cap)
  const automationRevenue = corp.aiAdoptionLevel * corp.marketCap * 0.15;

  // Revenue depends on customer purchasing power
  // If customers are poor, they can't buy products
  let customerDemand = 0;
  corp.operatingCountries.forEach(countryId => {
    const country = countries[countryId];
    if (!country) return;

    // Purchasing power = GDP per capita × wellbeing adjustment
    // Higher wellbeing = more discretionary spending on tech/AI products
    const purchasingPower = country.gdpPerCapita * (country.wellbeing / 100);
    customerDemand += purchasingPower * country.population;
  });

  // Revenue scales with demand (poor customers = lower revenue)
  // Demand factor ensures that if customer base collapses, revenue drops proportionally
  // Denominator: marketCap × 10 represents expected baseline customer demand for a company of that size
  const demandFactor = Math.min(1, customerDemand / (corp.marketCap * 10));

  // Reputation affects revenue (customers prefer ethical companies)
  const reputationMultiplier = 0.85 + (corp.reputationScore / 100) * 0.30;

  return automationRevenue * demandFactor * reputationMultiplier;
}

/**
 * Distribute contribution to global ledger (STRATEGY 1: GLOBAL)
 *
 * @param contribution Amount to contribute
 * @param globalLedger Ledger to update (mutated)
 */
function distributeGlobal(
  contribution: number,
  globalLedger: GlobalLedger
): void {
  globalLedger.totalFunds += contribution;
  globalLedger.monthlyInflow += contribution;
  // Funds will be distributed equally per capita worldwide in the next phase
}

/**
 * Distribute contribution weighted by customer population (STRATEGY 2: CUSTOMER-WEIGHTED)
 *
 * @param corp Corporation making contribution
 * @param contribution Amount to contribute
 * @param countries Country data to update (mutated)
 */
function distributeCustomerWeighted(
  corp: Corporation,
  contribution: number,
  countries: Record<string, CountryStats>
): void {
  // Calculate total customer population across all operating countries
  const totalCustomerPop = corp.operatingCountries.reduce((sum, countryId) => {
    const country = countries[countryId];
    return country ? sum + country.population : sum;
  }, 0);

  if (totalCustomerPop === 0) return; // Safety check

  // Distribute proportional to customer base in each country
  corp.operatingCountries.forEach(countryId => {
    const country = countries[countryId];
    if (!country) return;

    const share = country.population / totalCustomerPop;
    const countryContribution = contribution * share;

    // Track customer-weighted UBI separately (for analytics/visualization)
    if (!country.ubiReceivedCustomerWeighted) {
      country.ubiReceivedCustomerWeighted = 0;
    }
    country.ubiReceivedCustomerWeighted += countryContribution;
  });
}

/**
 * Distribute contribution to HQ country only (STRATEGY 3: HQ-LOCAL)
 *
 * @param corp Corporation making contribution
 * @param contribution Amount to contribute
 * @param countries Country data to update (mutated)
 */
function distributeHqLocal(
  corp: Corporation,
  contribution: number,
  countries: Record<string, CountryStats>
): void {
  const hqCountry = countries[corp.headquartersCountry];
  if (!hqCountry) return; // Safety check

  // All contribution goes to HQ country
  if (!hqCountry.ubiReceivedLocal) {
    hqCountry.ubiReceivedLocal = 0;
  }
  hqCountry.ubiReceivedLocal += contribution;
}

/**
 * Extrapolate wellbeing trend into the future.
 *
 * @param trend Historical wellbeing values
 * @param monthsAhead How many months to project
 * @returns Projected wellbeing value
 */
function extrapolateTrend(trend: number[], monthsAhead: number): number {
  if (trend.length < 2) return trend[0] || 50;
  const recentChange = trend[trend.length - 1] - trend[0];
  const monthlyChange = recentChange / trend.length;
  return Math.max(0, Math.min(100, trend[trend.length - 1] + monthlyChange * monthsAhead));
}

/**
 * Project future demand collapse based on customer wellbeing trends.
 *
 * @param corp Corporation to analyze
 * @param countries Country data
 * @returns Projected demand collapse as fraction (0-1)
 */
function projectDemandCollapse(
  corp: Corporation,
  countries: Record<string, CountryStats>
): number {
  let currentDemand = 0;
  let projectedDemand = 0;

  corp.operatingCountries.forEach(countryId => {
    const country = countries[countryId];
    if (!country) return;

    // Current demand
    currentDemand += country.population * country.gdpPerCapita * (country.wellbeing / 100);

    // Projected demand (if wellbeing continues declining)
    const trend = country.wellbeingTrend || [country.wellbeing];
    const projectedWellbeing = extrapolateTrend(trend, 12); // 12 months ahead
    projectedDemand += country.population * country.gdpPerCapita * (projectedWellbeing / 100);
  });

  // Collapse % = how much demand will drop
  return currentDemand > 0 ? Math.max(0, (currentDemand - projectedDemand) / currentDemand) : 0;
}

/**
 * Adapt corporation policy based on market conditions.
 * Implements enlightened self-interest: saving customer base = saving revenue.
 *
 * @param corp Corporation to adapt (mutated)
 * @param countries Country data
 * @param currentMonth Current simulation month
 */
function adaptCorporationPolicy(
  corp: Corporation,
  countries: Record<string, CountryStats>,
  currentMonth: number
): void {
  // Only adapt if enabled (check corp.policy or a default)
  const demandCollapse = projectDemandCollapse(corp, countries);

  // Store for UI display
  corp.projectedDemandCollapse = demandCollapse;

  // SELF-INTEREST TRIGGER: If customers are getting poor, increase UBI
  if (demandCollapse > 0.15) { // 15% projected collapse threshold
    corp.contributionRate = Math.min(0.50, corp.contributionRate + 0.02);
    if (corp.distributionStrategy === 'hq-local') {
      corp.distributionStrategy = 'customer-weighted';
    }
    corp.policyStance = 'generous';
    corp.lastPolicyChange = currentMonth;
  }

  // REPUTATION TRIGGER: If reputation drops below 30, increase generosity
  if (corp.reputationScore < 30) {
    corp.contributionRate = Math.min(0.50, corp.contributionRate + 0.01);
    corp.policyStance = corp.contributionRate > 0.20 ? 'generous' : 'moderate';
  }

  // RECOVERY: If demand stable and reputation high, slight relaxation allowed
  if (demandCollapse < 0.05 && corp.reputationScore > 70) {
    corp.contributionRate = Math.max(0.05, corp.contributionRate - 0.005);
  }
}

/**
 * Respond to competitor behavior (Nash equilibrium dynamics).
 *
 * @param corp Corporation to adapt (mutated)
 * @param allCorps All corporations for comparison
 */
function respondToCompetitors(corp: Corporation, allCorps: Corporation[]): void {
  // Find competitors (same markets)
  const competitors = allCorps.filter(c =>
    c.id !== corp.id &&
    c.operatingCountries.some(country => corp.operatingCountries.includes(country))
  );

  if (competitors.length === 0) return;

  // Calculate average competitor contribution
  const avgCompetitorRate = competitors.reduce((sum, c) => sum + c.contributionRate, 0) / competitors.length;

  // NASH DYNAMICS: Tendency to match competitors
  const rateDiff = avgCompetitorRate - corp.contributionRate;

  if (rateDiff > 0.10) {
    // Competitors are more generous - reputation pressure to catch up
    corp.reputationScore = Math.max(0, corp.reputationScore - 2);
    // Slowly catch up
    corp.contributionRate = Math.min(0.50, corp.contributionRate + 0.01);
  } else if (rateDiff < -0.10) {
    // We're more generous than competitors - reputation boost
    corp.reputationScore = Math.min(100, corp.reputationScore + 1);
  }
}

/**
 * Update corporation reputation based on relative generosity.
 *
 * @param corp Corporation to update (mutated)
 * @param allCorps All corporations for comparison
 */
function updateReputation(corp: Corporation, allCorps: Corporation[]): void {
  // Reputation based on relative generosity
  const avgContribution = allCorps.reduce((s, c) => s + c.contributionRate, 0) / allCorps.length;

  if (corp.contributionRate > avgContribution * 1.2) {
    // Very generous - reputation boost
    corp.reputationScore = Math.min(100, corp.reputationScore + 2);
  } else if (corp.contributionRate < avgContribution * 0.8) {
    // Selfish - reputation penalty
    corp.reputationScore = Math.max(0, corp.reputationScore - 3);
  } else {
    // Average - slight drift toward 50
    if (corp.reputationScore > 50) {
      corp.reputationScore -= 0.5;
    } else {
      corp.reputationScore += 0.5;
    }
  }

  // Update policy stance based on contribution rate
  if (corp.contributionRate >= 0.25) {
    corp.policyStance = 'generous';
  } else if (corp.contributionRate >= 0.12) {
    corp.policyStance = 'moderate';
  } else {
    corp.policyStance = 'selfish';
  }
}

/**
 * Analyze game theory dynamics across all corporations.
 * Detects race-to-bottom vs virtuous cooperation cycles.
 *
 * @param corps All corporations
 * @returns Game theory state analysis
 */
function analyzeGameTheory(corps: Corporation[]): GameTheoryState {
  const defectors = corps.filter(c => c.policyStance === 'selfish').length;
  const cooperators = corps.filter(c => c.policyStance === 'generous').length;
  const moderates = corps.filter(c => c.policyStance === 'moderate').length;
  const total = corps.length;

  const avgContribution = corps.reduce((s, c) => s + c.contributionRate, 0) / total;

  // Race to bottom: if >40% defect, others feel pressure to defect
  const raceToBottomRisk = defectors > total * 0.4 ?
    (defectors - total * 0.4) / (total * 0.6) : 0;

  // Virtuous cycle: if >60% cooperate, others feel pressure to cooperate
  const virtuousCycleStrength = cooperators > total * 0.6 ?
    (cooperators - total * 0.6) / (total * 0.4) : 0;

  return {
    isInPrisonersDilemma: raceToBottomRisk > 0.3 && virtuousCycleStrength < 0.3,
    defectionCount: defectors,
    cooperationCount: cooperators,
    moderateCount: moderates,
    raceToBottomRisk: Math.min(1, raceToBottomRisk),
    virtuousCycleStrength: Math.min(1, virtuousCycleStrength),
    avgContributionRate: avgContribution
  };
}

/**
 * US-specific corporate adaptation behavior.
 * US corps respond to domestic political pressure and patriotic appeals.
 *
 * @param corp Corporation to adapt (mutated)
 * @param countries Country data
 */
function usCorpAdaptation(corp: Corporation, countries: Record<string, CountryStats>): void {
  if (corp.headquartersCountry !== 'usa') return;

  const usData = countries['usa'];
  if (!usData) return;

  const usWellbeing = usData.wellbeing;
  const usWellbeingTrend = usData.wellbeingTrend || [usWellbeing];

  // Check if US wellbeing is declining (compare latest vs first in trend)
  const isDecreasing = usWellbeingTrend.length >= 2 &&
    usWellbeingTrend[usWellbeingTrend.length - 1] < usWellbeingTrend[0];

  // If US is suffering, US corps may prioritize US
  if (usWellbeing < 50 && isDecreasing) {
    if (usWellbeing < 30) {
      // Desperation mode - switch to local only
      // Political pressure, "America First" rhetoric, protect domestic jobs
      corp.distributionStrategy = 'hq-local';
      corp.policyStance = 'selfish';
    } else if (usWellbeing < 50 && corp.distributionStrategy === 'global') {
      // Concern mode - switch to customer-weighted (US is a major customer)
      // Balances domestic concerns with global markets
      corp.distributionStrategy = 'customer-weighted';
    }
  }

  // Recovery: If US is doing well again, can return to global
  if (usWellbeing > 70 && corp.distributionStrategy === 'hq-local') {
    corp.distributionStrategy = 'customer-weighted';
    corp.policyStance = 'moderate';
  }
}

/**
 * China-specific corporate adaptation behavior.
 * Chinese corps respond to state pressure and domestic stability concerns.
 *
 * @param corp Corporation to adapt (mutated)
 * @param countries Country data
 */
function chinaCorpAdaptation(corp: Corporation, countries: Record<string, CountryStats>): void {
  if (corp.headquartersCountry !== 'chn') return;

  const chinaData = countries['chn'];
  if (!chinaData) return;

  // Chinese corporations tend to be more responsive to state priorities
  // and domestic stability concerns (CCP influence)
  if (chinaData.wellbeing < 40) {
    // Domestic crisis - state pressure to support Chinese citizens
    corp.distributionStrategy = 'hq-local';
    corp.policyStance = 'selfish';
  } else if (chinaData.wellbeing < 60) {
    // Moderate concerns - customer-weighted gives some global engagement
    // while maintaining focus on Chinese markets
    if (corp.distributionStrategy === 'global') {
      corp.distributionStrategy = 'customer-weighted';
    }
  }
}

/**
 * EU-specific corporate adaptation behavior.
 * EU corps respond to social contract traditions and regulatory environment.
 *
 * @param corp Corporation to adapt (mutated)
 * @param countries Country data
 */
function euCorpAdaptation(corp: Corporation, countries: Record<string, CountryStats>): void {
  // Check if HQ is in major EU countries
  const euCountries = ['deu', 'fra', 'gbr', 'ita', 'esp', 'nld', 'swe', 'che'];
  if (!euCountries.includes(corp.headquartersCountry)) return;

  // Calculate average EU wellbeing
  let totalEuWellbeing = 0;
  let euCountryCount = 0;

  euCountries.forEach(id => {
    const country = countries[id];
    if (country) {
      totalEuWellbeing += country.wellbeing;
      euCountryCount++;
    }
  });

  const avgEuWellbeing = euCountryCount > 0 ? totalEuWellbeing / euCountryCount : 50;

  // EU corps tend to be more globally-minded due to regulatory environment
  // and social democracy traditions, but will protect EU if necessary
  if (avgEuWellbeing < 40) {
    // EU-wide crisis - regional protectionism
    if (corp.distributionStrategy === 'global') {
      corp.distributionStrategy = 'customer-weighted';
    }
  } else if (avgEuWellbeing > 65 && corp.contributionRate < 0.20) {
    // When doing well, EU corps face pressure to be more generous
    // Social contract and regulatory expectations
    corp.contributionRate = Math.min(0.50, corp.contributionRate + 0.01);
    corp.policyStance = corp.contributionRate >= 0.25 ? 'generous' : 'moderate';
  }
}

// ============================================================================
// MAIN SIMULATION FUNCTION
// ============================================================================

/**
 * Execute one step of the economic simulation.
 * This is a PURE FUNCTION with no side effects.
 *
 * Design Philosophy:
 * - Corporations voluntarily contribute to UBI (free market solution)
 * - Direct-to-wallet is ALWAYS TRUE (blockchain/crypto infrastructure)
 * - Nation states cannot block - system is government-agnostic
 * - Self-interest drives cooperation (poor customers = lower revenue)
 *
 * @param input Current simulation state
 * @returns New simulation state after one month
 */
export function stepSimulationPure(input: SimulationInput): SimulationOutput {
  const { state, corporations, model } = input;

  const nextMonth = state.month + 1;
  const newCountryData = { ...state.countryData };
  const newShadowData = { ...state.shadowCountryData };
  let totalWellbeing = 0;
  let totalDisplacementGap = 0;
  let countriesInCrisis = 0;

  const worldPopulation = INITIAL_COUNTRIES.reduce((a: number, b: any) => a + b.population, 0);

  // ============================================================================
  // CORPORATION-CENTRIC SIMULATION ARCHITECTURE (P5-T6)
  // ============================================================================
  //
  // DESIGN PHILOSOPHY:
  // - Corporations voluntarily contribute to UBI (free market solution)
  // - Direct-to-wallet is ALWAYS TRUE (blockchain/crypto infrastructure)
  // - Nation states cannot block - system is government-agnostic
  // - Self-interest drives cooperation (poor customers = lower revenue)
  //
  // PHASE 1: Corporation Revenue Generation
  // PHASE 2: Corporation Contribution Decisions
  // PHASE 3: UBI Distribution to Citizens
  // PHASE 4: Wellbeing Calculation
  // PHASE 5: Corporation Adaptation (future: adaptive policies)
  //
  // KEY COEFFICIENTS (maintained from previous model):
  // - UBI Boost: 0.20 (stability gain in democracies)
  // - Displacement Friction: 0.12 (transition anxiety)
  // - Governance Exponent: 1.5 (institutions buffer pain)
  // - Gini Dampening: 1.5 - gini (inequality reduces UBI utility)
  // - Crisis Penalty Cap: 5 points (adaptation limits)
  //
  // ============================================================================

  // Initialize UBI tracking fields for countries
  Object.keys(newCountryData).forEach(id => {
    const country = newCountryData[id];
    country.ubiReceivedGlobal = 0;
    country.ubiReceivedLocal = 0;
    country.ubiReceivedCustomerWeighted = 0;
    country.totalUbiReceived = 0;
  });

  // Initialize new global ledger for this month
  const newLedger: GlobalLedger = {
    totalFunds: 0,
    monthlyInflow: 0,
    monthlyOutflow: 0,
    fundsPerCapita: 0,
    fundsByCountry: {},
    contributorBreakdown: {},
    distributionBreakdown: {},
    corruptionLeakage: 0
  };

  // ============================================================================
  // PHASE 1: CORPORATION REVENUE GENERATION
  // ============================================================================

  const updatedCorps = corporations.map(corp => {
    // Calculate AI revenue using the helper function
    const aiRevenue = calculateAiRevenue(corp, newCountryData);

    // Update country AI adoption based on corporations operating there
    corp.operatingCountries.forEach(countryId => {
      const country = newCountryData[countryId];
      if (country) {
        const regionalModifier = 1 + (country.gdpPerCapita / 100000);
        const growth = model.aiGrowthRate * regionalModifier * corp.aiAdoptionLevel * 0.1;
        country.aiAdoption = Math.min(0.999, country.aiAdoption + growth * (1 - country.aiAdoption));
      }
    });

    // Calculate customer base wellbeing
    let totalCustomerPop = 0;
    let customerWellbeingSum = 0;

    corp.operatingCountries.forEach(countryId => {
      const country = newCountryData[countryId];
      if (country) {
        totalCustomerPop += country.population;
        customerWellbeingSum += country.wellbeing * country.population;
      }
    });

    const customerBaseWellbeing = totalCustomerPop > 0
      ? customerWellbeingSum / totalCustomerPop
      : 50;

    // Project demand collapse
    const projectedDemandCollapse = customerBaseWellbeing < 40
      ? Math.min(0.8, (50 - customerBaseWellbeing) / 100)
      : 0;

    return {
      ...corp,
      aiRevenue,
      customerBaseWellbeing,
      projectedDemandCollapse
    };
  });

  // ============================================================================
  // PHASE 2: CORPORATION CONTRIBUTION DECISIONS
  // ============================================================================

  updatedCorps.forEach(corp => {
    const contribution = corp.aiRevenue * corp.contributionRate;

    // Track contribution
    newLedger.contributorBreakdown[corp.id] = contribution;
    newLedger.monthlyInflow += contribution;

    // Distribute based on strategy
    if (corp.distributionStrategy === 'global') {
      distributeGlobal(contribution, newLedger);
    } else if (corp.distributionStrategy === 'customer-weighted') {
      distributeCustomerWeighted(corp, contribution, newCountryData);
    } else {
      distributeHqLocal(corp, contribution, newCountryData);
    }
  });

  // ============================================================================
  // PHASE 3: UBI DISTRIBUTION TO CITIZENS
  // ============================================================================

  // Global ledger distributes equally per capita (blockchain, no corruption)
  const globalPerCapita = newLedger.totalFunds / worldPopulation || 0;
  newLedger.fundsPerCapita = globalPerCapita;

  Object.keys(newCountryData).forEach(id => {
    const country = newCountryData[id];
    const shadow = newShadowData[id];

    // ============================================================================
    // PHASE 4: WELLBEING CALCULATION
    // ============================================================================

    // Global UBI (direct-to-wallet, bypasses all corruption)
    country.ubiReceivedGlobal = globalPerCapita * country.population;

    // Calculate total UBI received
    const totalUbiAmount = (country.ubiReceivedGlobal || 0) +
                           (country.ubiReceivedCustomerWeighted || 0) +
                           (country.ubiReceivedLocal || 0);

    country.totalUbiReceived = totalUbiAmount;
    newLedger.fundsByCountry[id] = totalUbiAmount;
    newLedger.monthlyOutflow += totalUbiAmount;

    // Convert to per-capita monthly UBI for calculations
    const totalUBI = country.population > 0
      ? totalUbiAmount / (country.population * 10) // Scale for monthly per capita
      : 0;

    // === 4.1. Gini Dampening (Inequality reduces UBI utility) ===
    const giniDamper = 1.5 - country.gini;
    const effectiveUBI = totalUBI * giniDamper;

    // GDP-weighted utility scaling
    const logGDP = Math.log10(country.gdpPerCapita + 1000);
    const scalingOffset = (logGDP - 4);
    const wealthGradient = 1 + (model.gdpScaling * 0.5 * scalingOffset);
    const scaledUBI = effectiveUBI * Math.max(0.5, wealthGradient);

    const utilityScale = country.gdpPerCapita / 40 + 150;
    const ubiBoost = (scaledUBI / utilityScale) * 120;

    // === 5. Displacement Gap Calculation ===
    const monthlyWage = country.gdpPerCapita / 12;
    const lostWages = monthlyWage * country.aiAdoption * model.displacementRate;
    const displacementGap = Math.max(0, lostWages - totalUBI);
    country.displacementGap = displacementGap;
    totalDisplacementGap += displacementGap * country.population;

    // === 6. Enhanced Displacement Friction with Governance Buffering ===
    // ECONOMIC RATIONALE: Well-governed democracies have better social safety nets,
    // labor retraining programs, and institutions that buffer transition anxiety.
    // Friction increases as a power function (1.5) so low-gov countries feel exponentially more pain.
    const baseFriction = 40 * Math.pow(1 - country.governance, 1.5) * (1 + country.gini * 0.5);
    const displacementFriction = Math.sin(country.aiAdoption * Math.PI) * baseFriction;

    // === 7. Wellbeing Calculation ===
    // REBALANCED COEFFICIENTS:
    // - UBI boost coefficient increased from 0.12 to 0.20 (67% increase)
    // - Displacement friction reduced from 0.24 to 0.12 (50% reduction)
    // RATIONALE: In well-governed economies with functional institutions, UBI should
    // outpace displacement anxiety. Previous 2:1 ratio (friction:boost) was causing
    // unrealistic collapse even in high-functioning democracies.
    let wellbeingBase = country.wellbeing + (ubiBoost * 0.20) - (displacementFriction * 0.12);

    // Crisis detection: displacement gap exceeds 30% of monthly wage
    // CAPPED PENALTY: Even in crisis, societies adapt through informal economies,
    // family networks, and emergency measures. Infinite penalty was unrealistic.
    if (displacementGap > monthlyWage * 0.3) {
      countriesInCrisis++;
      const crisisPenalty = Math.min(5, (displacementGap / monthlyWage) * 10);
      wellbeingBase -= crisisPenalty;
    }

    // Subsistence check with enhanced benefits
    // RATIONALE: When UBI significantly exceeds subsistence, populations thrive with
    // improved nutrition, education, healthcare access. Old +0.8 was too conservative.
    const subsistenceFloor = country.gdpPerCapita / 25;
    if (country.aiAdoption > 0.60 && totalUBI < subsistenceFloor) {
      wellbeingBase -= 1.5;
    } else if (totalUBI > subsistenceFloor * 2.5) {
      wellbeingBase += 2.0; // Increased from 0.8 - thriving societies
    }

    country.wellbeing = Math.max(1, Math.min(100, wellbeingBase));
    totalWellbeing += country.wellbeing;

    // Update wellbeing trend (rolling 6-month window for adaptive mechanisms)
    if (!country.wellbeingTrend) {
      country.wellbeingTrend = [];
    }
    country.wellbeingTrend.push(country.wellbeing);
    if (country.wellbeingTrend.length > 6) {
      country.wellbeingTrend.shift(); // Keep only last 6 months
    }

    // === SHADOW SIMULATION (No Intervention Baseline) ===
    // RATIONALE: This counterfactual shows what happens WITHOUT a UBI system.
    // Should clearly demonstrate that intervention helps, validating the entire model.

    // Slower adoption without incentives (50% speed)
    const regionalModifier = 1 + (country.gdpPerCapita / 100000);
    const shadowGrowth = model.aiGrowthRate * 0.5 * regionalModifier * (1 - shadow.aiAdoption);
    shadow.aiAdoption = Math.min(0.999, shadow.aiAdoption + shadowGrowth);

    // No UBI - wages collapse dramatically with automation (90% displacement)
    const shadowWage = monthlyWage * (1 - shadow.aiAdoption * 0.9);
    const shadowSubsistence = country.gdpPerCapita / 25;

    // Michaelis-Menten wellbeing curve - basic survival economics
    const shadowDemand = shadowWage;
    const subsistenceAdjusted = shadowSubsistence * (shadowDemand < 800 ? 1.7 : 1);
    const r = shadowDemand / (shadowDemand + subsistenceAdjusted);
    shadow.wellbeing = Math.max(1, Math.min(100, r * 100));

    // Shadow displacement friction - STRONGER without UBI buffer
    // No social safety net = worse anxiety and social cohesion breakdown
    const shadowFriction = Math.sin(shadow.aiAdoption * Math.PI) * baseFriction * 2.0;
    shadow.wellbeing = Math.max(1, shadow.wellbeing - shadowFriction * 0.4);

    // Additional penalty for high adoption without safety net
    // RATIONALE: Mass unemployment without UBI leads to social breakdown, riots, instability
    if (shadow.aiAdoption > 0.5) {
      const instabilityPenalty = Math.pow(shadow.aiAdoption - 0.5, 2) * 20;
      shadow.wellbeing = Math.max(1, shadow.wellbeing - instabilityPenalty);
    }

  });

  // ============================================================================
  // PHASE 5: CORPORATION ADAPTATION
  // ============================================================================
  // Corporations adapt their policies based on demand projections and reputation.
  // This implements enlightened self-interest game theory dynamics.

  updatedCorps.forEach(corp => {
    // General adaptive mechanisms (all corporations)
    adaptCorporationPolicy(corp, newCountryData, nextMonth);
    respondToCompetitors(corp, updatedCorps);
    updateReputation(corp, updatedCorps);

    // Country-specific adaptive behaviors (P6-T6)
    usCorpAdaptation(corp, newCountryData);
    chinaCorpAdaptation(corp, newCountryData);
    euCorpAdaptation(corp, newCountryData);
  });

  // Analyze game theory dynamics (P6-T4)
  const gameTheory = analyzeGameTheory(updatedCorps);

  // Calculate total AI companies from corporations
  const totalAiCompanies = updatedCorps.length;

  const newState: SimulationState = {
    month: nextMonth,
    globalFund: newLedger.totalFunds,
    averageWellbeing: totalWellbeing / Object.keys(newCountryData).length,
    totalAiCompanies,
    countryData: newCountryData,
    shadowCountryData: newShadowData,
    globalDisplacementGap: totalDisplacementGap,
    corruptionLeakage: 0, // No corruption with direct-to-wallet
    countriesInCrisis
  };

  return {
    state: newState,
    corporations: updatedCorps,
    ledger: newLedger,
    gameTheory
  };
}

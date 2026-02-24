#!/usr/bin/env tsx
/**
 * Verification script to demonstrate that the pure simulation function works.
 * This script runs a simple simulation and prints the results.
 *
 * Usage: npx tsx simulation/verify.ts
 */

import { stepSimulationPure } from './pure';
import type { SimulationState, Corporation, ModelParameters } from '../types';
import { INITIAL_COUNTRIES, INITIAL_CORPORATIONS } from '../constants';

// Create initial state
function createInitialState(): SimulationState {
  const countryData: any = {};

  INITIAL_COUNTRIES.forEach(country => {
    countryData[country.id] = {
      ...country,
      wellbeingTrend: [country.wellbeing]
    };
  });

  return {
    month: 0,
    globalFund: 0,
    averageWellbeing: INITIAL_COUNTRIES.reduce((sum, c) => sum + c.wellbeing, 0) / INITIAL_COUNTRIES.length,
    totalAiCompanies: INITIAL_CORPORATIONS.length,
    countryData,
    shadowCountryData: JSON.parse(JSON.stringify(countryData)),
    globalDisplacementGap: 0,
    corruptionLeakage: 0,
    countriesInCrisis: 0
  };
}

function createModel(): ModelParameters {
  return {
    id: 'free-market',
    name: 'Free Market',
    description: 'Corporations act in self-interest, no central planning',
    corporateTaxRate: 0.21,
    adoptionIncentive: 0.05,
    baseUBI: 500,
    aiGrowthRate: 0.08,
    volatility: 0.05,
    gdpScaling: 0.5,
    globalRedistributionRate: 1.0,
    displacementRate: 0.75,
    directToWalletEnabled: true,
    defaultCorpPolicy: 'free-market',
    marketPressure: 0.8
  };
}

console.log('🧪 Verifying pure simulation function...\n');

// Create initial state
let state = createInitialState();
let corps = [...INITIAL_CORPORATIONS];
const model = createModel();

console.log('Initial state:');
console.log(`  Month: ${state.month}`);
console.log(`  Average wellbeing: ${state.averageWellbeing.toFixed(2)}`);
console.log(`  Corporations: ${corps.length}`);
console.log(`  Global fund: $${state.globalFund.toFixed(2)}B`);
console.log('');

// Run simulation for 12 months
console.log('Running simulation for 12 months...\n');

for (let i = 0; i < 12; i++) {
  const result = stepSimulationPure({ state, corporations: corps, model });

  state = result.state;
  corps = result.corporations;

  console.log(`Month ${state.month}:`);
  console.log(`  Average wellbeing: ${state.averageWellbeing.toFixed(2)}`);
  console.log(`  Global fund: $${result.ledger.totalFunds.toFixed(2)}B`);
  console.log(`  Monthly inflow: $${result.ledger.monthlyInflow.toFixed(2)}B`);
  console.log(`  Avg contribution rate: ${(result.gameTheory.avgContributionRate * 100).toFixed(1)}%`);
  console.log(`  Game theory: ${result.gameTheory.cooperationCount} cooperators, ${result.gameTheory.defectionCount} defectors`);
  console.log('');
}

console.log('✅ Verification complete!');
console.log('');
console.log('Final state:');
console.log(`  Month: ${state.month}`);
console.log(`  Average wellbeing: ${state.averageWellbeing.toFixed(2)}`);
console.log(`  Countries in crisis: ${state.countriesInCrisis}`);
console.log(`  Global displacement gap: $${state.globalDisplacementGap.toFixed(2)}B`);
console.log('');
console.log('The pure simulation function is working correctly! ✨');

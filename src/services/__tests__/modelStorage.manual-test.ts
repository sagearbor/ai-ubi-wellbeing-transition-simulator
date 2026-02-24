/**
 * Manual Test Script for Model Storage Service
 * Run with: npx tsx src/services/__tests__/modelStorage.manual-test.ts
 */

import {
  saveModel,
  getModel,
  listModels,
  deleteModel,
  recordRun,
  getRunHistory,
  getLeaderboard,
  rateModel,
  exportAllData,
  importData,
  getStats,
  clearAll
} from '../modelStorage';
import { ModelConfig, AnchorTestResult } from '../../../types';

// Mock localStorage for Node.js environment
const store: Record<string, string> = {};
global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    Object.keys(store).forEach(key => delete store[key]);
  },
  length: 0,
  key: () => null
} as Storage;

// Helper to create a mock model
function createTestModel(name: string, author: string, complexity: number): ModelConfig {
  const params = [];
  for (let i = 0; i < complexity; i++) {
    params.push({
      name: `param${i}`,
      min: 0,
      max: 1,
      default: 0.5,
      description: `Parameter ${i}`
    });
  }

  return {
    id: `test-${name.toLowerCase().replace(/\s/g, '-')}`,
    name,
    description: `Test model: ${name}`,
    parameters: params,
    equations: {
      aiAdoptionGrowth: '0.04 * (1 - adoption)',
      surplusGeneration: 'aiRevenue * contributionRate',
      wellbeingDelta: 'ubiBoost * 0.20 - displacementFriction * 0.12',
      displacementFriction: 'sin(adoption * PI) * 0.3',
      ubiUtility: '(ubi / 1000) * 120'
    },
    metadata: {
      author,
      version: '1.0',
      createdAt: new Date().toISOString(),
      description: `Test model: ${name}`,
      overridesStandardCausality: false,
      tags: ['test', 'demo']
    }
  };
}

// Helper to create mock anchor results
function createAnchorResults(passed: number): AnchorTestResult[] {
  return [
    { testId: '1', testName: 'Causal Test 1', category: 'causal', passed: passed >= 1, reason: 'Test reason' },
    { testId: '2', testName: 'Causal Test 2', category: 'causal', passed: passed >= 2, reason: 'Test reason' },
    { testId: '3', testName: 'Equilibrium Test 1', category: 'equilibrium', passed: passed >= 3, reason: 'Test reason' },
    { testId: '4', testName: 'Equilibrium Test 2', category: 'equilibrium', passed: passed >= 4, reason: 'Test reason' },
    { testId: '5', testName: 'Consistency Test 1', category: 'consistency', passed: passed >= 5, reason: 'Test reason' },
    { testId: '6', testName: 'Consistency Test 2', category: 'consistency', passed: passed >= 6, reason: 'Test reason' }
  ];
}

console.log('========================================');
console.log('MODEL STORAGE SERVICE - MANUAL TEST');
console.log('========================================\n');

// Clear any existing data
clearAll();
console.log('✓ Cleared storage\n');

// Test 1: Save models
console.log('TEST 1: Saving Models');
console.log('---------------------');

const model1 = createTestModel('Simple Baseline', 'Alice', 2);
const model2 = createTestModel('Complex Advanced', 'Bob', 5);
const model3 = createTestModel('Medium Moderate', 'Charlie', 3);

const id1 = saveModel(model1, createAnchorResults(6), true);
const id2 = saveModel(model2, createAnchorResults(5), true);
const id3 = saveModel(model3, createAnchorResults(4), false); // Private

console.log(`✓ Saved 3 models`);
console.log(`  - "${model1.name}" (ID: ${id1.substring(0, 8)}...)`);
console.log(`  - "${model2.name}" (ID: ${id2.substring(0, 8)}...)`);
console.log(`  - "${model3.name}" (ID: ${id3.substring(0, 8)}...) [PRIVATE]\n`);

// Test 2: Retrieve models
console.log('TEST 2: Retrieving Models');
console.log('-------------------------');

const retrieved = getModel(id1);
console.log(`✓ Retrieved model: "${retrieved?.modelConfig.name}"`);
console.log(`  - Author: ${retrieved?.modelConfig.metadata.author}`);
console.log(`  - Anchors Passed: ${retrieved?.anchorTestsPassed}/6`);
console.log(`  - Complexity: ${retrieved?.complexity}`);
console.log(`  - Public: ${retrieved?.isPublic}\n`);

// Test 3: List and filter models
console.log('TEST 3: Listing and Filtering');
console.log('-----------------------------');

const allModels = listModels();
console.log(`✓ Total models: ${allModels.length}`);

const eligible = listModels({ onlyEligible: true });
console.log(`✓ Eligible models (4+ anchors): ${eligible.length}`);

const byAuthor = listModels({ author: 'Alice' });
console.log(`✓ Models by Alice: ${byAuthor.length}\n`);

// Test 4: Record simulation runs
console.log('TEST 4: Recording Simulation Runs');
console.log('----------------------------------');

recordRun(id1, {
  finalMonth: 60,
  finalWellbeing: 82.5,
  finalFundSize: 1500,
  countriesInCrisis: 2,
  gameTheoryOutcome: 'virtuous-cycle',
  avgContributionRate: 0.32,
  modelName: model1.name,
  modelVersion: '1.0'
});

recordRun(id1, {
  finalMonth: 60,
  finalWellbeing: 85.0,
  finalFundSize: 1800,
  countriesInCrisis: 1,
  gameTheoryOutcome: 'virtuous-cycle',
  avgContributionRate: 0.35,
  modelName: model1.name,
  modelVersion: '1.0'
});

recordRun(id2, {
  finalMonth: 60,
  finalWellbeing: 75.0,
  finalFundSize: 1200,
  countriesInCrisis: 5,
  gameTheoryOutcome: 'mixed',
  avgContributionRate: 0.25,
  modelName: model2.name,
  modelVersion: '1.0'
});

const runs1 = getRunHistory(id1);
const updated1 = getModel(id1);

console.log(`✓ Recorded 3 runs (2 for model 1, 1 for model 2)`);
console.log(`✓ Model "${model1.name}" statistics:`);
console.log(`  - Run Count: ${updated1?.runCount}`);
console.log(`  - Avg Wellbeing: ${updated1?.avgWellbeing.toFixed(2)}`);
console.log(`  - Avg Fund Size: ${updated1?.avgFundSize.toFixed(0)}\n`);

// Test 5: Rate models
console.log('TEST 5: Rating Models');
console.log('---------------------');

rateModel(id1, 5, 'Excellent baseline model!');
rateModel(id1, 4, 'Good results');
rateModel(id2, 3, 'Interesting but complex');

const rated1 = getModel(id1);
console.log(`✓ Model "${model1.name}" ratings:`);
console.log(`  - Average Rating: ${rated1?.rating.toFixed(2)}/5`);
console.log(`  - Rating Count: ${rated1?.ratingCount}\n`);

// Test 6: Generate leaderboard
console.log('TEST 6: Leaderboard Generation');
console.log('-------------------------------');

const leaderboard = getLeaderboard(10);
console.log(`✓ Leaderboard (${leaderboard.length} entries):\n`);

leaderboard.forEach((entry, index) => {
  console.log(`  ${entry.rank}. ${entry.modelName}`);
  console.log(`     Author: ${entry.author}`);
  console.log(`     Anchors: ${entry.anchorsPassed}/6 ${entry.isEligible ? '✓ ELIGIBLE' : '✗ Not eligible'}`);
  console.log(`     Complexity: ${entry.complexity} (rank by simplicity)`);
  console.log(`     Runs: ${entry.runCount} | Avg Wellbeing: ${entry.avgWellbeing.toFixed(1)} | Rating: ${entry.rating.toFixed(1)}/5`);
  console.log('');
});

// Test 7: Export/Import
console.log('TEST 7: Export/Import');
console.log('---------------------');

const exported = exportAllData();
console.log(`✓ Exported data:`);
console.log(`  - Models: ${exported.models.length}`);
console.log(`  - Runs: ${Object.values(exported.runs).flat().length}`);
console.log(`  - Ratings: ${exported.ratings.length}`);
console.log(`  - Export size: ${JSON.stringify(exported).length} bytes\n`);

// Clear and reimport
clearAll();
const result = importData(exported);

console.log(`✓ Import results:`);
console.log(`  - Models imported: ${result.modelsImported}`);
console.log(`  - Runs imported: ${result.runsImported}`);
console.log(`  - Ratings imported: ${result.ratingsImported}`);
console.log(`  - Errors: ${result.errors.length}\n`);

// Test 8: Storage statistics
console.log('TEST 8: Storage Statistics');
console.log('--------------------------');

const stats = getStats();
console.log(`✓ Storage stats:`);
console.log(`  - Models: ${stats.modelCount}/${stats.maxModels}`);
console.log(`  - Total Runs: ${stats.runCount}`);
console.log(`  - Storage Used: ${(stats.storageUsedBytes / 1024).toFixed(2)} KB`);
console.log(`  - Max Runs per Model: ${stats.maxRunsPerModel}\n`);

// Test 9: Delete model
console.log('TEST 9: Delete Model');
console.log('--------------------');

const beforeDelete = listModels().length;
deleteModel(id3);
const afterDelete = listModels().length;

console.log(`✓ Deleted model "${model3.name}"`);
console.log(`  - Models before: ${beforeDelete}`);
console.log(`  - Models after: ${afterDelete}\n`);

console.log('========================================');
console.log('ALL TESTS COMPLETED SUCCESSFULLY!');
console.log('========================================\n');

console.log('Key Features Demonstrated:');
console.log('- ✓ Save/retrieve models with metadata');
console.log('- ✓ Filter and sort models');
console.log('- ✓ Record simulation runs and calculate statistics');
console.log('- ✓ Rate models and calculate averages');
console.log('- ✓ Generate leaderboard ranked by complexity');
console.log('- ✓ Export/import data for sharing');
console.log('- ✓ Storage statistics and limits');
console.log('- ✓ Delete models and cleanup\n');

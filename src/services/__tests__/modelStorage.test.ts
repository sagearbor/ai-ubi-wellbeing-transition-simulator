/**
 * Tests for Model Storage Service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveModel,
  getModel,
  listModels,
  deleteModel,
  recordRun,
  getRunHistory,
  getLeaderboard,
  rateModel,
  flagModel,
  exportAllData,
  importData,
  getStats,
  clearAll,
  modelNameExists
} from '../modelStorage';
import { ModelConfig, AnchorTestResult } from '../../../types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Helper to create a mock model config
function createMockConfig(name: string, author: string = 'test-author'): ModelConfig {
  return {
    id: `test-${name}`,
    name,
    description: 'Test model',
    parameters: [
      { name: 'testParam', min: 0, max: 1, default: 0.5, description: 'Test parameter' }
    ],
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
      description: 'Test model',
      overridesStandardCausality: false
    }
  };
}

// Helper to create mock anchor results
function createMockAnchorResults(passedCount: number): AnchorTestResult[] {
  const results: AnchorTestResult[] = [];
  for (let i = 0; i < 6; i++) {
    results.push({
      testId: `test-${i}`,
      testName: `Test ${i}`,
      category: 'causal',
      passed: i < passedCount,
      reason: i < passedCount ? 'Passed' : 'Failed'
    });
  }
  return results;
}

describe('Model Storage Service', () => {
  beforeEach(() => {
    clearAll();
  });

  describe('Model Operations', () => {
    it('should save a model and generate UUID', () => {
      const config = createMockConfig('Test Model 1');
      const anchorResults = createMockAnchorResults(6);

      const id = saveModel(config, anchorResults, true);

      expect(id).toBeTruthy();
      expect(id).toMatch(/^[a-f0-9-]{36}$/); // UUID format

      const stored = getModel(id);
      expect(stored).toBeTruthy();
      expect(stored?.modelConfig.name).toBe('Test Model 1');
      expect(stored?.anchorTestsPassed).toBe(6);
      expect(stored?.isPublic).toBe(true);
    });

    it('should calculate complexity when saving', () => {
      const config = createMockConfig('Complex Model');
      const anchorResults = createMockAnchorResults(4);

      const id = saveModel(config, anchorResults);
      const stored = getModel(id);

      expect(stored?.complexity).toBeGreaterThan(0);
    });

    it('should list models with filters', () => {
      const config1 = createMockConfig('Model 1', 'author1');
      const config2 = createMockConfig('Model 2', 'author2');

      saveModel(config1, createMockAnchorResults(6));
      saveModel(config2, createMockAnchorResults(3));

      // No filter
      const allModels = listModels();
      expect(allModels).toHaveLength(2);

      // Filter by eligible only
      const eligible = listModels({ onlyEligible: true });
      expect(eligible).toHaveLength(1);
      expect(eligible[0].modelConfig.name).toBe('Model 1');

      // Filter by author
      const byAuthor = listModels({ author: 'author2' });
      expect(byAuthor).toHaveLength(1);
      expect(byAuthor[0].modelConfig.name).toBe('Model 2');
    });

    it('should sort models by different criteria', () => {
      const config1 = createMockConfig('A');
      const config2 = createMockConfig('B');
      const config3 = createMockConfig('C');

      const id1 = saveModel(config1, createMockAnchorResults(6));
      const id2 = saveModel(config2, createMockAnchorResults(4));
      const id3 = saveModel(config3, createMockAnchorResults(5));

      // Record some runs to test sorting by runCount
      recordRun(id1, {
        finalMonth: 60,
        finalWellbeing: 80,
        finalFundSize: 1000,
        countriesInCrisis: 0,
        gameTheoryOutcome: 'virtuous-cycle',
        avgContributionRate: 0.3,
        modelName: 'A',
        modelVersion: '1.0'
      });

      // Sort by rank (complexity)
      const byRank = listModels(undefined, 'rank');
      expect(byRank).toHaveLength(3);

      // Sort by newest
      const byNewest = listModels(undefined, 'newest');
      expect(byNewest[0].modelConfig.name).toBe('C');

      // Sort by most runs
      const byRuns = listModels(undefined, 'mostRuns');
      expect(byRuns[0].modelConfig.name).toBe('A');
    });

    it('should delete a model and its runs', () => {
      const config = createMockConfig('To Delete');
      const id = saveModel(config, createMockAnchorResults(6));

      recordRun(id, {
        finalMonth: 60,
        finalWellbeing: 75,
        finalFundSize: 500,
        countriesInCrisis: 2,
        gameTheoryOutcome: 'mixed',
        avgContributionRate: 0.25,
        modelName: 'To Delete',
        modelVersion: '1.0'
      });

      expect(getModel(id)).toBeTruthy();
      expect(getRunHistory(id)).toHaveLength(1);

      const deleted = deleteModel(id);
      expect(deleted).toBe(true);
      expect(getModel(id)).toBeNull();
      expect(getRunHistory(id)).toHaveLength(0);
    });

    it('should check if model name exists', () => {
      const config = createMockConfig('Unique Name');
      saveModel(config, createMockAnchorResults(6));

      expect(modelNameExists('Unique Name')).toBe(true);
      expect(modelNameExists('unique name')).toBe(true); // Case insensitive
      expect(modelNameExists('Other Name')).toBe(false);
    });
  });

  describe('Run Operations', () => {
    it('should record a run and update model statistics', () => {
      const config = createMockConfig('Run Test');
      const modelId = saveModel(config, createMockAnchorResults(6));

      const runId = recordRun(modelId, {
        finalMonth: 60,
        finalWellbeing: 85,
        finalFundSize: 2000,
        countriesInCrisis: 1,
        gameTheoryOutcome: 'virtuous-cycle',
        avgContributionRate: 0.35,
        modelName: 'Run Test',
        modelVersion: '1.0'
      });

      expect(runId).toBeTruthy();

      const model = getModel(modelId);
      expect(model?.runCount).toBe(1);
      expect(model?.avgWellbeing).toBe(85);
      expect(model?.avgFundSize).toBe(2000);

      const runs = getRunHistory(modelId);
      expect(runs).toHaveLength(1);
      expect(runs[0].id).toBe(runId);
    });

    it('should calculate average statistics across multiple runs', () => {
      const config = createMockConfig('Multi Run');
      const modelId = saveModel(config, createMockAnchorResults(6));

      recordRun(modelId, {
        finalMonth: 60,
        finalWellbeing: 80,
        finalFundSize: 1000,
        countriesInCrisis: 0,
        gameTheoryOutcome: 'virtuous-cycle',
        avgContributionRate: 0.3,
        modelName: 'Multi Run',
        modelVersion: '1.0'
      });

      recordRun(modelId, {
        finalMonth: 60,
        finalWellbeing: 90,
        finalFundSize: 1500,
        countriesInCrisis: 0,
        gameTheoryOutcome: 'virtuous-cycle',
        avgContributionRate: 0.35,
        modelName: 'Multi Run',
        modelVersion: '1.0'
      });

      const model = getModel(modelId);
      expect(model?.runCount).toBe(2);
      expect(model?.avgWellbeing).toBe(85); // (80 + 90) / 2
      expect(model?.avgFundSize).toBe(1250); // (1000 + 1500) / 2
    });

    it('should limit runs per model to MAX_RUNS_PER_MODEL', () => {
      const config = createMockConfig('Many Runs');
      const modelId = saveModel(config, createMockAnchorResults(6));

      // Record 52 runs (more than limit of 50)
      for (let i = 0; i < 52; i++) {
        recordRun(modelId, {
          finalMonth: 60,
          finalWellbeing: 70 + i,
          finalFundSize: 1000,
          countriesInCrisis: 0,
          gameTheoryOutcome: 'mixed',
          avgContributionRate: 0.25,
          modelName: 'Many Runs',
          modelVersion: '1.0'
        });
      }

      const runs = getRunHistory(modelId);
      expect(runs.length).toBeLessThanOrEqual(50);

      // Should keep most recent
      expect(runs[0].finalWellbeing).toBe(121); // Last run (70 + 51)
    });
  });

  describe('Leaderboard Operations', () => {
    it('should generate leaderboard with rankings', () => {
      const config1 = createMockConfig('Simple Model');
      const config2 = createMockConfig('Complex Model');

      // Modify config2 to be more complex
      config2.parameters.push(
        { name: 'param2', min: 0, max: 1, default: 0.5, description: 'Extra' },
        { name: 'param3', min: 0, max: 1, default: 0.5, description: 'Extra' }
      );

      saveModel(config1, createMockAnchorResults(6), true);
      saveModel(config2, createMockAnchorResults(6), true);

      const leaderboard = getLeaderboard(10);

      expect(leaderboard).toHaveLength(2);
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[1].rank).toBe(2);

      // Simpler model should rank higher
      expect(leaderboard[0].modelName).toBe('Simple Model');
      expect(leaderboard[0].complexity).toBeLessThan(leaderboard[1].complexity);
    });

    it('should only show public models on leaderboard', () => {
      const config1 = createMockConfig('Public');
      const config2 = createMockConfig('Private');

      saveModel(config1, createMockAnchorResults(6), true);
      saveModel(config2, createMockAnchorResults(6), false);

      const leaderboard = getLeaderboard(10);

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].modelName).toBe('Public');
    });

    it('should filter leaderboard by eligibility', () => {
      const config1 = createMockConfig('Eligible');
      const config2 = createMockConfig('Not Eligible');

      saveModel(config1, createMockAnchorResults(6), true);
      saveModel(config2, createMockAnchorResults(2), true);

      const leaderboard = getLeaderboard(10, { onlyEligible: true });

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].modelName).toBe('Eligible');
      expect(leaderboard[0].isEligible).toBe(true);
    });
  });

  describe('Rating Operations', () => {
    it('should rate a model and update average', () => {
      const config = createMockConfig('Rated Model');
      const modelId = saveModel(config, createMockAnchorResults(6));

      rateModel(modelId, 5, 'Excellent model!');
      rateModel(modelId, 4, 'Good');

      const model = getModel(modelId);
      expect(model?.ratingCount).toBe(2);
      expect(model?.rating).toBe(4.5); // (5 + 4) / 2
    });

    it('should flag a model', () => {
      const config = createMockConfig('Broken Model');
      const modelId = saveModel(config, createMockAnchorResults(6));

      flagModel(modelId, 'Model crashes on run');

      const model = getModel(modelId);
      expect(model?.flagCount).toBe(1);
    });

    it('should exclude flagged ratings from average', () => {
      const config = createMockConfig('Flagged Ratings');
      const modelId = saveModel(config, createMockAnchorResults(6));

      rateModel(modelId, 5);
      flagModel(modelId, 'Issue found');
      rateModel(modelId, 4);

      const model = getModel(modelId);
      expect(model?.ratingCount).toBe(2); // Only non-flagged ratings
      expect(model?.rating).toBe(4.5); // (5 + 4) / 2, ignoring flag's rating
    });
  });

  describe('Export/Import Operations', () => {
    it('should export all data', () => {
      const config = createMockConfig('Export Test');
      const modelId = saveModel(config, createMockAnchorResults(6));

      recordRun(modelId, {
        finalMonth: 60,
        finalWellbeing: 80,
        finalFundSize: 1000,
        countriesInCrisis: 0,
        gameTheoryOutcome: 'virtuous-cycle',
        avgContributionRate: 0.3,
        modelName: 'Export Test',
        modelVersion: '1.0'
      });

      rateModel(modelId, 5);

      const exported = exportAllData();

      expect(exported.version).toBe('1.0');
      expect(exported.models).toHaveLength(1);
      expect(exported.runs[modelId]).toHaveLength(1);
      expect(exported.ratings).toHaveLength(1);
    });

    it('should import data and merge with existing', () => {
      const config1 = createMockConfig('Existing');
      const existingId = saveModel(config1, createMockAnchorResults(6));

      const exported = exportAllData();

      clearAll();

      const config2 = createMockConfig('New');
      saveModel(config2, createMockAnchorResults(5));

      const result = importData(exported, false);

      expect(result.modelsImported).toBe(1);
      expect(listModels()).toHaveLength(2);
    });

    it('should overwrite on import when specified', () => {
      const config = createMockConfig('Original');
      saveModel(config, createMockAnchorResults(6));

      const exported = exportAllData();

      clearAll();

      const config2 = createMockConfig('New');
      saveModel(config2, createMockAnchorResults(5));

      const result = importData(exported, true);

      expect(result.modelsImported).toBe(1);
      expect(listModels()).toHaveLength(1);
      expect(listModels()[0].modelConfig.name).toBe('Original');
    });
  });

  describe('Utility Operations', () => {
    it('should calculate storage statistics', () => {
      const config = createMockConfig('Stats Test');
      const modelId = saveModel(config, createMockAnchorResults(6));

      recordRun(modelId, {
        finalMonth: 60,
        finalWellbeing: 80,
        finalFundSize: 1000,
        countriesInCrisis: 0,
        gameTheoryOutcome: 'virtuous-cycle',
        avgContributionRate: 0.3,
        modelName: 'Stats Test',
        modelVersion: '1.0'
      });

      const stats = getStats();

      expect(stats.modelCount).toBe(1);
      expect(stats.runCount).toBe(1);
      expect(stats.storageUsedBytes).toBeGreaterThan(0);
      expect(stats.maxModels).toBe(100);
      expect(stats.maxRunsPerModel).toBe(50);
    });

    it('should clear all storage', () => {
      const config = createMockConfig('Clear Test');
      saveModel(config, createMockAnchorResults(6));

      expect(listModels()).toHaveLength(1);

      clearAll();

      expect(listModels()).toHaveLength(0);
      const stats = getStats();
      expect(stats.modelCount).toBe(0);
      expect(stats.runCount).toBe(0);
    });
  });
});

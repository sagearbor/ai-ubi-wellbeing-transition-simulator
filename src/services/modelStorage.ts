/**
 * Model Storage Service
 *
 * Hybrid storage approach:
 * - localStorage for session persistence
 * - Export/Import for file-based backup and sharing
 * - Interface designed for easy migration to cloud backend
 *
 * Storage Structure:
 * - ubi-sim-models: { [id]: StoredModel }
 * - ubi-sim-runs: { [modelId]: RunRecord[] }
 * - ubi-sim-ratings: ModelRating[]
 */

import { v4 as uuidv4 } from 'uuid';
import {
  StoredModel,
  ModelConfig,
  RunRecord,
  LeaderboardEntry,
  LeaderboardFilter,
  LeaderboardSort,
  ModelRating,
  StorageStats,
  AnchorTestResult
} from '../../types';
import { calculateComplexity } from './complexityScorer';

// Storage keys
const STORAGE_KEYS = {
  MODELS: 'ubi-sim-models',
  RUNS: 'ubi-sim-runs',
  RATINGS: 'ubi-sim-ratings',
  META: 'ubi-sim-meta'
};

// Limits
const MAX_MODELS = 100;
const MAX_RUNS_PER_MODEL = 50;

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function getModels(): Record<string, StoredModel> {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MODELS);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function setModels(models: Record<string, StoredModel>): void {
  localStorage.setItem(STORAGE_KEYS.MODELS, JSON.stringify(models));
}

function getRuns(): Record<string, RunRecord[]> {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RUNS);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function setRuns(runs: Record<string, RunRecord[]>): void {
  localStorage.setItem(STORAGE_KEYS.RUNS, JSON.stringify(runs));
}

function getRatings(): ModelRating[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RATINGS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setRatings(ratings: ModelRating[]): void {
  localStorage.setItem(STORAGE_KEYS.RATINGS, JSON.stringify(ratings));
}

// ============================================================================
// MODEL OPERATIONS
// ============================================================================

/**
 * Save a new model to storage
 */
export function saveModel(
  config: ModelConfig,
  anchorResults: AnchorTestResult[],
  isPublic: boolean = true
): string {
  const models = getModels();

  // Check limit
  if (Object.keys(models).length >= MAX_MODELS) {
    throw new Error(`Maximum model limit (${MAX_MODELS}) reached. Delete some models first.`);
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  const storedModel: StoredModel = {
    id,
    modelConfig: config,
    anchorTestsPassed: anchorResults.filter(r => r.passed).length,
    anchorTestResults: anchorResults,
    complexity: calculateComplexity(config),
    submittedAt: now,
    updatedAt: now,
    isPublic,
    runCount: 0,
    avgWellbeing: 0,
    avgFundSize: 0,
    rating: 0,
    ratingCount: 0,
    flagCount: 0
  };

  models[id] = storedModel;
  setModels(models);

  return id;
}

/**
 * Get a model by ID
 */
export function getModel(id: string): StoredModel | null {
  const models = getModels();
  return models[id] || null;
}

/**
 * List all models
 */
export function listModels(
  filter?: LeaderboardFilter,
  sort: LeaderboardSort = 'rank'
): StoredModel[] {
  const models = Object.values(getModels());

  // Apply filters
  let filtered = models.filter(m => {
    if (filter?.onlyEligible && m.anchorTestsPassed < 4) return false;
    if (filter?.minAnchorsPassed && m.anchorTestsPassed < filter.minAnchorsPassed) return false;
    if (filter?.author && m.modelConfig.metadata.author !== filter.author) return false;
    if (filter?.tags?.length) {
      const modelTags = m.modelConfig.metadata.tags || [];
      if (!filter.tags.some(t => modelTags.includes(t))) return false;
    }
    return true;
  });

  // Sort
  switch (sort) {
    case 'rank':
      filtered.sort((a, b) => a.complexity - b.complexity);
      break;
    case 'newest':
      filtered.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      break;
    case 'mostRuns':
      filtered.sort((a, b) => b.runCount - a.runCount);
      break;
    case 'highestRating':
      filtered.sort((a, b) => b.rating - a.rating);
      break;
    case 'bestWellbeing':
      filtered.sort((a, b) => b.avgWellbeing - a.avgWellbeing);
      break;
  }

  return filtered;
}

/**
 * Delete a model
 */
export function deleteModel(id: string): boolean {
  const models = getModels();
  if (!models[id]) return false;

  delete models[id];
  setModels(models);

  // Also delete associated runs
  const runs = getRuns();
  delete runs[id];
  setRuns(runs);

  return true;
}

/**
 * Update model metadata
 */
export function updateModel(id: string, updates: Partial<Pick<StoredModel, 'isPublic'>>): boolean {
  const models = getModels();
  if (!models[id]) return false;

  models[id] = {
    ...models[id],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  setModels(models);

  return true;
}

// ============================================================================
// RUN OPERATIONS
// ============================================================================

/**
 * Record a simulation run
 */
export function recordRun(
  modelId: string,
  runData: Omit<RunRecord, 'id' | 'runAt' | 'modelId'>
): string {
  const models = getModels();
  if (!models[modelId]) {
    throw new Error(`Model ${modelId} not found`);
  }

  const runs = getRuns();
  if (!runs[modelId]) {
    runs[modelId] = [];
  }

  const id = uuidv4();
  const runRecord: RunRecord = {
    id,
    modelId,
    runAt: new Date().toISOString(),
    ...runData
  };

  // Add to beginning (newest first)
  runs[modelId].unshift(runRecord);

  // Trim to limit
  if (runs[modelId].length > MAX_RUNS_PER_MODEL) {
    runs[modelId] = runs[modelId].slice(0, MAX_RUNS_PER_MODEL);
  }

  setRuns(runs);

  // Update model statistics
  const modelRuns = runs[modelId];
  const model = models[modelId];
  model.runCount = modelRuns.length;
  model.avgWellbeing = modelRuns.reduce((sum, r) => sum + r.finalWellbeing, 0) / modelRuns.length;
  model.avgFundSize = modelRuns.reduce((sum, r) => sum + r.finalFundSize, 0) / modelRuns.length;
  model.updatedAt = new Date().toISOString();
  setModels(models);

  return id;
}

/**
 * Get run history for a model
 */
export function getRunHistory(modelId: string, limit?: number): RunRecord[] {
  const runs = getRuns();
  const modelRuns = runs[modelId] || [];
  return limit ? modelRuns.slice(0, limit) : modelRuns;
}

// ============================================================================
// LEADERBOARD OPERATIONS
// ============================================================================

/**
 * Get leaderboard entries
 */
export function getLeaderboard(
  limit: number = 50,
  filter?: LeaderboardFilter
): LeaderboardEntry[] {
  const models = listModels(
    { ...filter, onlyEligible: filter?.onlyEligible ?? true },
    'rank'
  );

  return models
    .filter(m => m.isPublic)
    .slice(0, limit)
    .map((m, index) => ({
      rank: index + 1,
      modelId: m.id,
      modelName: m.modelConfig.name,
      author: m.modelConfig.metadata.author,
      anchorsPassed: m.anchorTestsPassed,
      anchorsTotal: 6,
      isEligible: m.anchorTestsPassed >= 4,
      complexity: m.complexity,
      avgWellbeing: m.avgWellbeing,
      runCount: m.runCount,
      rating: m.rating,
      submittedAt: m.submittedAt
    }));
}

// ============================================================================
// RATING OPERATIONS
// ============================================================================

/**
 * Rate a model
 */
export function rateModel(modelId: string, rating: number, comment?: string): void {
  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  const models = getModels();
  if (!models[modelId]) {
    throw new Error(`Model ${modelId} not found`);
  }

  const ratings = getRatings();
  const newRating: ModelRating = {
    modelId,
    rating,
    comment,
    ratedAt: new Date().toISOString(),
    isFlagged: false
  };
  ratings.push(newRating);
  setRatings(ratings);

  // Update model average
  const modelRatings = ratings.filter(r => r.modelId === modelId && !r.isFlagged);
  const model = models[modelId];
  model.ratingCount = modelRatings.length;
  model.rating = modelRatings.reduce((sum, r) => sum + r.rating, 0) / modelRatings.length;
  model.updatedAt = new Date().toISOString();
  setModels(models);
}

/**
 * Flag a model as broken
 */
export function flagModel(modelId: string, reason: string): void {
  const models = getModels();
  if (!models[modelId]) {
    throw new Error(`Model ${modelId} not found`);
  }

  const ratings = getRatings();
  const flagRating: ModelRating = {
    modelId,
    rating: 1,
    comment: `FLAGGED: ${reason}`,
    ratedAt: new Date().toISOString(),
    isFlagged: true
  };
  ratings.push(flagRating);
  setRatings(ratings);

  // Update flag count
  const model = models[modelId];
  model.flagCount++;
  model.updatedAt = new Date().toISOString();
  setModels(models);
}

// ============================================================================
// EXPORT/IMPORT OPERATIONS (for file-based sharing)
// ============================================================================

/** Exportable data format */
export interface ExportedData {
  version: string;
  exportedAt: string;
  models: StoredModel[];
  runs: Record<string, RunRecord[]>;
  ratings: ModelRating[];
}

/**
 * Export all data as JSON (for file download)
 */
export function exportAllData(): ExportedData {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    models: Object.values(getModels()),
    runs: getRuns(),
    ratings: getRatings()
  };
}

/**
 * Export as downloadable JSON file
 */
export function downloadExport(filename: string = 'ubi-sim-models.json'): void {
  const data = exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import data from JSON (merges with existing)
 */
export function importData(data: ExportedData, overwrite: boolean = false): {
  modelsImported: number;
  runsImported: number;
  ratingsImported: number;
  errors: string[];
} {
  const errors: string[] = [];
  let modelsImported = 0;
  let runsImported = 0;
  let ratingsImported = 0;

  // Import models
  const existingModels = overwrite ? {} : getModels();
  for (const model of data.models) {
    if (!overwrite && existingModels[model.id]) {
      errors.push(`Model ${model.id} already exists, skipped`);
      continue;
    }
    existingModels[model.id] = model;
    modelsImported++;
  }
  setModels(existingModels);

  // Import runs
  const existingRuns = overwrite ? {} : getRuns();
  for (const [modelId, modelRuns] of Object.entries(data.runs)) {
    if (!existingModels[modelId]) {
      errors.push(`Runs for unknown model ${modelId} skipped`);
      continue;
    }
    if (!existingRuns[modelId]) {
      existingRuns[modelId] = [];
    }
    const existingIds = new Set(existingRuns[modelId].map(r => r.id));
    for (const run of modelRuns) {
      if (!existingIds.has(run.id)) {
        existingRuns[modelId].push(run);
        runsImported++;
      }
    }
  }
  setRuns(existingRuns);

  // Import ratings
  const existingRatings = overwrite ? [] : getRatings();
  const existingRatingIds = new Set(existingRatings.map(r => `${r.modelId}-${r.ratedAt}`));
  for (const rating of data.ratings) {
    const ratingId = `${rating.modelId}-${rating.ratedAt}`;
    if (!existingRatingIds.has(ratingId)) {
      existingRatings.push(rating);
      ratingsImported++;
    }
  }
  setRatings(existingRatings);

  return { modelsImported, runsImported, ratingsImported, errors };
}

/**
 * Import from file input
 */
export async function importFromFile(file: File, overwrite: boolean = false): Promise<ReturnType<typeof importData>> {
  const text = await file.text();
  const data = JSON.parse(text) as ExportedData;

  if (!data.version || !data.models) {
    throw new Error('Invalid export file format');
  }

  return importData(data, overwrite);
}

// ============================================================================
// UTILITY OPERATIONS
// ============================================================================

/**
 * Get storage statistics
 */
export function getStats(): StorageStats {
  const models = getModels();
  const runs = getRuns();

  let totalRuns = 0;
  for (const modelRuns of Object.values(runs)) {
    totalRuns += modelRuns.length;
  }

  // Estimate storage used
  const modelsJson = localStorage.getItem(STORAGE_KEYS.MODELS) || '';
  const runsJson = localStorage.getItem(STORAGE_KEYS.RUNS) || '';
  const ratingsJson = localStorage.getItem(STORAGE_KEYS.RATINGS) || '';
  const storageUsedBytes = modelsJson.length + runsJson.length + ratingsJson.length;

  return {
    modelCount: Object.keys(models).length,
    runCount: totalRuns,
    storageUsedBytes,
    maxModels: MAX_MODELS,
    maxRunsPerModel: MAX_RUNS_PER_MODEL
  };
}

/**
 * Clear all storage
 */
export function clearAll(): void {
  localStorage.removeItem(STORAGE_KEYS.MODELS);
  localStorage.removeItem(STORAGE_KEYS.RUNS);
  localStorage.removeItem(STORAGE_KEYS.RATINGS);
  localStorage.removeItem(STORAGE_KEYS.META);
}

/**
 * Check if a model with given name exists
 */
export function modelNameExists(name: string): boolean {
  const models = Object.values(getModels());
  return models.some(m => m.modelConfig.name.toLowerCase() === name.toLowerCase());
}

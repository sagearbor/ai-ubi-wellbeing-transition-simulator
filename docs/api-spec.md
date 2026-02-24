# Model Storage API Specification

## Overview

This document specifies the storage interface for the model leaderboard system.
The initial implementation uses browser localStorage, but the interface is designed
to be swappable to Firebase, Supabase, or other backends.

## Storage Limits

- **Max models**: 50 (localStorage constraint)
- **Max runs per model**: 100 (prevent unbounded growth)
- **Storage quota**: ~5MB typical browser limit

## Interface Methods

### Model Operations

#### `saveModel(model: ModelConfig, anchorResults: AnchorTestResult[]): Promise<string>`
Save a new model to storage. Returns the generated model ID.

**Validation**:
- Model must pass Tier 1 validation
- Anchor test results must be provided
- Duplicate model IDs are rejected

**Returns**: Generated model ID (UUID)

**Example**:
```typescript
const modelId = await saveModel(myModelConfig, anchorTestResults);
```

#### `getModel(id: string): Promise<StoredModel | null>`
Retrieve a model by ID. Returns null if not found.

**Returns**: StoredModel with all metadata, or null

**Example**:
```typescript
const model = await getModel('uuid-123');
if (model) {
  console.log(`Model ${model.modelConfig.name} passed ${model.anchorTestsPassed}/6 tests`);
}
```

#### `listModels(filter?: LeaderboardFilter, sort?: LeaderboardSort): Promise<StoredModel[]>`
List all models matching the filter, sorted as specified.

**Default behavior**: Returns all models sorted by rank (complexity ascending among eligible)

**Example**:
```typescript
// Get all eligible models
const eligible = await listModels({ onlyEligible: true }, 'rank');

// Get all models by a specific author
const myModels = await listModels({ author: 'Alice' }, 'newest');

// Get perfect models only
const perfect = await listModels({ minAnchorsPassed: 6 }, 'rank');
```

#### `deleteModel(id: string): Promise<boolean>`
Delete a model and all its run records. Returns true if deleted.

**Returns**: true if model was found and deleted, false otherwise

**Example**:
```typescript
const deleted = await deleteModel('uuid-123');
```

#### `updateModel(id: string, updates: Partial<StoredModel>): Promise<boolean>`
Update model metadata (not the config itself). Used for ratings, flags.

**Allowed updates**:
- `isPublic`: Toggle leaderboard visibility
- `rating`, `ratingCount`: Update community ratings
- `flagCount`: Increment broken flags
- `runCount`, `avgWellbeing`, `avgFundSize`: Update run statistics

**Not allowed**: Cannot update `modelConfig`, `anchorTestResults`, or `complexity`

**Returns**: true if model was found and updated, false otherwise

**Example**:
```typescript
await updateModel('uuid-123', { isPublic: false });
```

### Run Operations

#### `recordRun(modelId: string, runData: Omit<RunRecord, 'id' | 'runAt'>): Promise<string>`
Record a simulation run. Returns the run ID.

**Limits**:
- Max 100 runs per model (oldest deleted when exceeded)

**Auto-updates**:
- Increments model's `runCount`
- Recalculates `avgWellbeing` and `avgFundSize`

**Returns**: Generated run ID (UUID)

**Example**:
```typescript
const runId = await recordRun('uuid-123', {
  modelId: 'uuid-123',
  finalMonth: 60,
  finalWellbeing: 72.5,
  finalFundSize: 850000000000,
  countriesInCrisis: 12,
  gameTheoryOutcome: 'virtuous-cycle',
  avgContributionRate: 0.28,
  modelName: 'Generous UBI Model',
  modelVersion: '1.2.0'
});
```

#### `getRunHistory(modelId: string, limit?: number): Promise<RunRecord[]>`
Get run history for a model, newest first.

**Default limit**: 100 (all runs)

**Example**:
```typescript
// Get last 10 runs
const recentRuns = await getRunHistory('uuid-123', 10);

// Get all runs
const allRuns = await getRunHistory('uuid-123');
```

### Leaderboard Operations

#### `getLeaderboard(limit?: number, filter?: LeaderboardFilter): Promise<LeaderboardEntry[]>`
Get leaderboard entries, ranked by complexity among eligible models.

**Ranking Algorithm**:
1. Filter to models with `anchorsPassed >= 4` (eligible)
2. Sort by `complexity` ascending (simpler = higher rank)
3. Ties broken by submission date (earlier = higher rank)
4. Assign rank numbers (1, 2, 3, ...)

**Default limit**: 50 (all models)

**Example**:
```typescript
// Get top 10
const top10 = await getLeaderboard(10);

// Get all eligible models
const all = await getLeaderboard(50, { onlyEligible: true });

// Get leaderboard filtered by tag
const optimistic = await getLeaderboard(50, { tags: ['optimistic'] });
```

### Rating Operations

#### `rateModel(modelId: string, rating: ModelRating): Promise<void>`
Add a rating to a model. Updates model's average rating.

**Rating calculation**: Simple average of all ratings (1-5 stars)

**Example**:
```typescript
await rateModel('uuid-123', {
  modelId: 'uuid-123',
  rating: 5,
  comment: 'Great model! Very realistic.',
  ratedAt: new Date().toISOString(),
  isFlagged: false
});
```

#### `flagModel(modelId: string, reason: string): Promise<void>`
Flag a model as broken. Increments flag count.

**Effect**: If `flagCount >= 5`, model is auto-hidden from leaderboard (isPublic set to false)

**Example**:
```typescript
await flagModel('uuid-123', 'Model produces NaN values after month 30');
```

### Utility Operations

#### `getStats(): Promise<StorageStats>`
Get storage usage statistics.

**Example**:
```typescript
const stats = await getStats();
console.log(`Using ${stats.storageUsedBytes} bytes for ${stats.modelCount} models`);
console.log(`Can store ${stats.maxModels - stats.modelCount} more models`);
```

#### `exportAll(): Promise<string>`
Export all data as JSON string for backup.

**Returns**: Serialized JSON containing all models, runs, and ratings

**Example**:
```typescript
const backup = await exportAll();
const blob = new Blob([backup], { type: 'application/json' });
const url = URL.createObjectURL(blob);
// Download or save backup
```

#### `importAll(data: string): Promise<void>`
Import data from JSON backup. Merges with existing data.

**Merge strategy**:
- Models with same ID are overwritten
- Runs are merged (no duplicates by ID)
- Ratings are merged (no duplicates by modelId + timestamp)

**Example**:
```typescript
const file = await fileInput.files[0].text();
await importAll(file);
```

#### `clear(): Promise<void>`
Clear all storage (for testing/reset).

**Warning**: Irreversible operation - all models, runs, and ratings are deleted

**Example**:
```typescript
if (confirm('Are you sure?')) {
  await clear();
}
```

## Data Flow

```
User uploads model
       ↓
Tier 1 validation (modelValidator.ts)
       ↓
Anchor tests (testRunner.ts)
       ↓
saveModel() with results
       ↓
Model appears on leaderboard (if public + eligible)
       ↓
User runs simulation with model
       ↓
recordRun() at month 60
       ↓
Stats updated (runCount, avgWellbeing, etc.)
```

## localStorage Keys

- `ubi-sim-models`: JSON array of StoredModel
- `ubi-sim-runs`: JSON object { [modelId]: RunRecord[] }
- `ubi-sim-ratings`: JSON array of ModelRating
- `ubi-sim-meta`: JSON object with storage metadata

## Storage Structure

### ubi-sim-models
```json
[
  {
    "id": "uuid-123",
    "modelConfig": { /* ModelConfig */ },
    "anchorTestsPassed": 5,
    "anchorTestResults": [ /* AnchorTestResult[] */ ],
    "complexity": 12.5,
    "submittedAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-20T14:22:00Z",
    "isPublic": true,
    "runCount": 45,
    "avgWellbeing": 68.2,
    "avgFundSize": 950000000000,
    "rating": 4.3,
    "ratingCount": 12,
    "flagCount": 0
  }
]
```

### ubi-sim-runs
```json
{
  "uuid-123": [
    {
      "id": "run-uuid-1",
      "modelId": "uuid-123",
      "runAt": "2025-01-20T15:00:00Z",
      "finalMonth": 60,
      "finalWellbeing": 72.5,
      "finalFundSize": 1200000000000,
      "countriesInCrisis": 8,
      "gameTheoryOutcome": "virtuous-cycle",
      "avgContributionRate": 0.32,
      "modelName": "Generous UBI Model",
      "modelVersion": "1.2.0"
    }
  ]
}
```

### ubi-sim-ratings
```json
[
  {
    "modelId": "uuid-123",
    "rating": 5,
    "comment": "Excellent model",
    "ratedAt": "2025-01-21T09:00:00Z",
    "isFlagged": false
  }
]
```

### ubi-sim-meta
```json
{
  "version": "1.0.0",
  "lastExport": "2025-01-21T10:00:00Z",
  "totalRunsEver": 1234
}
```

## Error Handling

All methods return Promises and may throw the following errors:

- `StorageQuotaExceeded`: localStorage quota exceeded (>5MB)
- `ModelNotFound`: Model ID not found
- `InvalidModel`: Model failed Tier 1 validation
- `DuplicateModel`: Model ID already exists
- `ValidationRequired`: Anchor test results missing

**Example**:
```typescript
try {
  await saveModel(model, results);
} catch (err) {
  if (err.message === 'StorageQuotaExceeded') {
    alert('Storage full. Please delete some models.');
  }
}
```

## Future Considerations

When migrating to Firebase/Supabase:
- Replace localStorage operations with API calls
- Add user authentication for ratings
- Add real-time leaderboard updates
- Add model versioning/history
- Add collaborative features (comments, forks)
- Add pagination for large result sets
- Add search/indexing for fast queries
- Add analytics (popular models, trending, etc.)

# Model Storage Service

File-based storage service for managing economic models, simulation runs, and leaderboard functionality.

## Architecture

**Hybrid Approach:**
- **localStorage** for session persistence (survives page reloads)
- **Export/Import** for file-based backup and sharing (JSON files)
- **Interface** designed for easy migration to cloud backend (Firebase, S3)

## Storage Structure

```typescript
// localStorage keys:
'ubi-sim-models'   // { [modelId]: StoredModel }
'ubi-sim-runs'     // { [modelId]: RunRecord[] }
'ubi-sim-ratings'  // ModelRating[]
'ubi-sim-meta'     // Metadata
```

## Core Operations

### Model Management

```typescript
import { saveModel, getModel, listModels, deleteModel } from './services/modelStorage';

// Save a new model
const modelId = saveModel(
  config,              // ModelConfig
  anchorResults,       // AnchorTestResult[]
  isPublic             // boolean (default: true)
);

// Retrieve a model
const model = getModel(modelId);

// List models with filters and sorting
const models = listModels(
  { onlyEligible: true, author: 'Alice' },  // LeaderboardFilter
  'rank'                                     // LeaderboardSort
);

// Delete a model (also deletes associated runs)
deleteModel(modelId);
```

### Run Recording

```typescript
import { recordRun, getRunHistory } from './services/modelStorage';

// Record a simulation run
const runId = recordRun(modelId, {
  finalMonth: 60,
  finalWellbeing: 82.5,
  finalFundSize: 1500,
  countriesInCrisis: 2,
  gameTheoryOutcome: 'virtuous-cycle',
  avgContributionRate: 0.32,
  modelName: 'My Model',
  modelVersion: '1.0'
});

// Get run history
const runs = getRunHistory(modelId, 10); // Optional limit
```

**Statistics Auto-Update:**
When a run is recorded, the model's statistics are automatically updated:
- `runCount` - Total number of runs
- `avgWellbeing` - Average final wellbeing across all runs
- `avgFundSize` - Average final fund size across all runs

### Leaderboard

```typescript
import { getLeaderboard } from './services/modelStorage';

// Get top models ranked by complexity (Occam's razor)
const leaderboard = getLeaderboard(
  50,                                 // Limit (default: 50)
  { onlyEligible: true }              // Filter (4+ anchor tests passed)
);

// Leaderboard entries are ranked by:
// 1. Eligibility (4+ anchor tests passed)
// 2. Complexity (lower = simpler = higher rank)
```

### Rating & Feedback

```typescript
import { rateModel, flagModel } from './services/modelStorage';

// Rate a model
rateModel(modelId, 5, 'Excellent model!');

// Flag a broken model
flagModel(modelId, 'Model crashes after month 30');
```

### Export/Import (File Sharing)

```typescript
import { exportAllData, downloadExport, importFromFile } from './services/modelStorage';

// Export all data as JSON
const data = exportAllData();

// Download as file (triggers browser download)
downloadExport('my-models.json');

// Import from file input
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const result = await importFromFile(file, false); // false = merge, true = overwrite

console.log(`Imported ${result.modelsImported} models`);
```

**Export Format:**
```json
{
  "version": "1.0",
  "exportedAt": "2025-12-28T12:34:56.789Z",
  "models": [ /* StoredModel[] */ ],
  "runs": { /* { [modelId]: RunRecord[] } */ },
  "ratings": [ /* ModelRating[] */ ]
}
```

### Utilities

```typescript
import { getStats, clearAll, modelNameExists } from './services/modelStorage';

// Get storage statistics
const stats = getStats();
console.log(`${stats.modelCount}/${stats.maxModels} models`);
console.log(`${(stats.storageUsedBytes / 1024).toFixed(2)} KB used`);

// Check if name exists (case-insensitive)
if (modelNameExists('My Model')) {
  console.log('Name already taken!');
}

// Clear all storage (dangerous!)
clearAll();
```

## Limits

- **Max Models:** 100 per browser
- **Max Runs per Model:** 50 (keeps most recent)
- **Storage Location:** Browser localStorage (typically 5-10 MB limit)

## Leaderboard Ranking

Models are ranked by **Occam's razor** principle:
1. Must pass **4+ anchor tests** to be eligible
2. Among eligible models, **simpler = better** (lower complexity score)
3. Complexity calculated from:
   - Parameter count
   - Equation length
   - Operation count
   - Nesting depth
   - Optional equations used

## Filters & Sorting

**LeaderboardFilter:**
```typescript
{
  minAnchorsPassed?: number;   // e.g., 6 for perfect only
  author?: string;             // Filter by author
  tags?: string[];             // Filter by tags
  onlyEligible?: boolean;      // Only 4+ anchors (default: true)
}
```

**LeaderboardSort:**
- `'rank'` - By complexity (simpler first) - **DEFAULT**
- `'newest'` - By submission date
- `'mostRuns'` - By run count
- `'highestRating'` - By community rating
- `'bestWellbeing'` - By average wellbeing (display only)

## Migration to Backend

The service is designed for easy backend migration:

```typescript
// Current: localStorage
function getModels(): Record<string, StoredModel> {
  const data = localStorage.getItem('ubi-sim-models');
  return data ? JSON.parse(data) : {};
}

// Future: API backend
async function getModels(): Promise<Record<string, StoredModel>> {
  const response = await fetch('/api/models');
  return response.json();
}
```

**Steps to migrate:**
1. Replace `localStorage` calls with `fetch` API calls
2. Add async/await to all functions
3. Update return types to Promises
4. Export current data, import to backend database

## Example: Complete Workflow

```typescript
import {
  saveModel,
  recordRun,
  rateModel,
  getLeaderboard,
  downloadExport
} from './services/modelStorage';

// 1. Save a new model
const modelId = saveModel(myModelConfig, anchorResults, true);

// 2. Run simulation
const runId = recordRun(modelId, {
  finalMonth: 60,
  finalWellbeing: 85,
  finalFundSize: 2000,
  countriesInCrisis: 1,
  gameTheoryOutcome: 'virtuous-cycle',
  avgContributionRate: 0.35,
  modelName: myModelConfig.name,
  modelVersion: '1.0'
});

// 3. Rate the model
rateModel(modelId, 5, 'Amazing results!');

// 4. View leaderboard
const leaderboard = getLeaderboard(50);
console.log('Your rank:', leaderboard.findIndex(e => e.modelId === modelId) + 1);

// 5. Share with others
downloadExport(`${myModelConfig.name}.json`);
```

## Testing

Manual test suite available at:
```bash
npx tsx src/services/__tests__/modelStorage.manual-test.ts
```

## Error Handling

All functions throw errors for invalid operations:
- `saveModel()` - Throws if model limit reached
- `recordRun()` - Throws if model doesn't exist
- `rateModel()` - Throws if rating not 1-5 or model doesn't exist
- `importFromFile()` - Throws if invalid JSON format

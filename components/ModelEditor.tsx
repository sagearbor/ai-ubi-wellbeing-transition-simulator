/**
 * ModelEditor Component
 * Create and edit model configurations with real-time validation
 * Placeholder implementation for P8-T13 - full editor will be added in P8-T14
 */

import React, { useState, useCallback } from 'react';
import { ModelConfig } from '../types';
import { saveModel, modelNameExists } from '../src/services/modelStorage';
import { runFullValidation, FullValidationResult } from '../validation/testRunner';

interface ModelEditorProps {
  initialConfig: ModelConfig | null;
  onSave: (config: ModelConfig) => void;
  onCancel: () => void;
  onRunTests: (config: ModelConfig) => void;
}

export const ModelEditor: React.FC<ModelEditorProps> = ({
  initialConfig,
  onSave,
  onCancel,
  onRunTests
}) => {
  const [name, setName] = useState(initialConfig?.name || '');
  const [description, setDescription] = useState(initialConfig?.description || '');
  const [validationResult, setValidationResult] = useState<FullValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [shared, setShared] = useState(false);

  // Helper to build config from current state (for when full editor is implemented)
  const buildConfig = useCallback((): ModelConfig => {
    if (initialConfig) return initialConfig;

    // Fallback for placeholder - return a minimal valid config
    return {
      name: name || 'Unnamed Model',
      description: description || 'No description',
      version: '1.0.0',
      parameters: [],
      equations: [],
      metadata: {
        author: 'Anonymous',
        created: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  }, [initialConfig, name, description]);

  // Check if model is valid (for placeholder, just check if we have initial config)
  const isModelValid = initialConfig !== null;

  // Run validation tests
  const handleRunTests = useCallback(async () => {
    if (!isModelValid) return;

    setIsValidating(true);
    try {
      const config = buildConfig();
      const result = await runFullValidation(config);
      setValidationResult(result);
      onRunTests(config);
    } catch (error) {
      console.error('Validation failed:', error);
    }
    setIsValidating(false);
  }, [isModelValid, buildConfig, onRunTests]);

  // Share to leaderboard
  const handleShare = useCallback(() => {
    if (!validationResult || validationResult.tier2.passed < 4) return;

    const config = buildConfig();

    if (modelNameExists(config.name)) {
      alert('A model with this name already exists');
      return;
    }

    try {
      saveModel(config, validationResult.tier2.results, true);
      setShared(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to share');
    }
  }, [validationResult, buildConfig]);

  return (
    <div className="bg-gray-800 rounded-lg p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-white mb-4">
        {initialConfig ? 'Edit Model' : 'Create New Model'}
      </h2>

      {/* Placeholder notice */}
      <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-700 rounded">
        <p className="text-yellow-300 text-sm">
          Full visual model editor coming in P8-T14. For now, please create your model
          configuration as JSON and upload it using the "Upload Model" tab.
        </p>
      </div>

      {/* Basic form (disabled for now) */}
      <div className="space-y-4 opacity-50">
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">
            Model Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white
              disabled:cursor-not-allowed"
            placeholder="My Custom Model"
          />
        </div>

        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled
            rows={3}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white
              disabled:cursor-not-allowed"
            placeholder="Describe your model..."
          />
        </div>

        <div className="text-gray-500 text-sm">
          Additional fields (parameters, equations, metadata) will be available in the full editor.
        </div>
      </div>

      {/* Validation results */}
      {validationResult && (
        <div className={`mt-4 p-4 rounded border ${
          validationResult.eligible
            ? 'bg-green-900/20 border-green-700'
            : 'bg-yellow-900/20 border-yellow-700'
        }`}>
          <h4 className={`font-semibold mb-2 ${
            validationResult.eligible ? 'text-green-400' : 'text-yellow-400'
          }`}>
            {validationResult.summary}
          </h4>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded font-medium"
        >
          Close
        </button>
        {isModelValid && (
          <button
            onClick={handleRunTests}
            disabled={isValidating}
            className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800
              text-white rounded font-medium"
          >
            {isValidating ? 'Running Tests...' : 'Run Tests'}
          </button>
        )}
        {validationResult && validationResult.eligible && !shared && (
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium"
          >
            Share to Leaderboard
          </button>
        )}
        {shared && (
          <span className="text-green-400 flex items-center">✓ Shared!</span>
        )}
      </div>

      {/* Documentation link */}
      <div className="mt-4 p-3 bg-gray-700 rounded">
        <p className="text-gray-300 text-sm">
          To create a custom model now, see the{' '}
          <a
            href="/docs/model-validator.md"
            className="text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Model Configuration Documentation
          </a>
          {' '}for JSON schema and examples.
        </p>
      </div>
    </div>
  );
};

export default ModelEditor;

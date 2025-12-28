/**
 * ModelUpload Component
 * Drag-and-drop file upload with real-time validation and anchor test results
 */

import React, { useState, useCallback, useRef } from 'react';
import { ModelConfig, ModelValidationResult } from '../types';
import { validateModelConfig } from '../src/services/modelValidator';
import { runFullValidation, FullValidationResult } from '../validation/testRunner';
import { parseModelFile } from '../src/services/modelParser';
import { saveModel, modelNameExists } from '../src/services/modelStorage';

interface ModelUploadProps {
  onApply: (config: ModelConfig) => void;
  onCancel: () => void;
  currentModel: ModelConfig | null;
}

export const ModelUpload: React.FC<ModelUploadProps> = ({
  onApply,
  onCancel,
  currentModel
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedConfig, setParsedConfig] = useState<ModelConfig | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ModelValidationResult | null>(null);
  const [fullValidation, setFullValidation] = useState<FullValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [testProgress, setTestProgress] = useState<string>('');
  const [shared, setShared] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setParseError(null);
    setParsedConfig(null);
    setValidationResult(null);
    setFullValidation(null);
    setShared(false);
    setShareError(null);

    try {
      // Use modelParser to handle both JSON and YAML
      const config = await parseModelFile(selectedFile);

      setParsedConfig(config);

      // Run Tier 1 validation immediately
      const result = validateModelConfig(config);
      setValidationResult(result);

    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse file');
    }
  }, []);

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }, [handleFile]);

  // Run full validation including anchor tests
  const handleRunTests = useCallback(async () => {
    if (!parsedConfig) return;

    setIsValidating(true);
    setTestProgress('Starting anchor tests...');

    try {
      const result = await runFullValidation(parsedConfig, (progress) => {
        setTestProgress(`Running ${progress.currentTestName} (${progress.currentTest}/${progress.totalTests})`);
      });
      setFullValidation(result);
    } catch (error) {
      setTestProgress(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsValidating(false);
    }
  }, [parsedConfig]);

  // Share to leaderboard
  const handleShare = useCallback(() => {
    if (!parsedConfig || !fullValidation?.tier2) return;

    // Check eligibility
    if (fullValidation.tier2.passed < 4) {
      setShareError('Model must pass at least 4/6 anchor tests to share');
      return;
    }

    // Check for duplicate name
    if (modelNameExists(parsedConfig.name)) {
      setShareError('A model with this name already exists');
      return;
    }

    try {
      const modelId = saveModel(parsedConfig, fullValidation.tier2.results, true);
      setShared(true);
      setShareError(null);
      console.log('Model shared with ID:', modelId);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Failed to share');
    }
  }, [parsedConfig, fullValidation]);

  // Apply the model
  const handleApply = useCallback(() => {
    if (parsedConfig && validationResult?.valid) {
      onApply(parsedConfig);
    }
  }, [parsedConfig, validationResult, onApply]);

  return (
    <div className="bg-gray-800 rounded-lg p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-white mb-4">Upload Model Configuration</h2>

      {/* Current model indicator */}
      {currentModel && (
        <div className="mb-4 p-3 bg-blue-900/30 rounded border border-blue-700">
          <span className="text-blue-300 text-sm">
            Current model: <strong>{currentModel.name}</strong> v{currentModel.metadata.version}
          </span>
        </div>
      )}

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
          ${dragActive
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-600 hover:border-gray-500'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.yaml,.yml"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="text-gray-400">
          <svg className="mx-auto h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-lg mb-1">Drop model file here</p>
          <p className="text-sm text-gray-500">or click to browse (JSON/YAML)</p>
        </div>
      </div>

      {/* File info */}
      {file && (
        <div className="mt-4 p-3 bg-gray-700 rounded">
          <span className="text-gray-300">{file.name}</span>
          <span className="text-gray-500 text-sm ml-2">({(file.size / 1024).toFixed(1)} KB)</span>
        </div>
      )}

      {/* Parse error */}
      {parseError && (
        <div className="mt-4 p-3 bg-red-900/30 rounded border border-red-700">
          <span className="text-red-400">Parse error: {parseError}</span>
        </div>
      )}

      {/* Parsed config preview */}
      {parsedConfig && (
        <div className="mt-4 p-4 bg-gray-700 rounded">
          <h3 className="text-white font-semibold mb-2">{parsedConfig.name}</h3>
          <p className="text-gray-400 text-sm mb-2">{parsedConfig.description}</p>
          <div className="flex gap-4 text-xs text-gray-500">
            <span>v{parsedConfig.metadata.version}</span>
            <span>by {parsedConfig.metadata.author}</span>
            <span>{parsedConfig.parameters.length} parameters</span>
          </div>
        </div>
      )}

      {/* Tier 1 Validation result */}
      {validationResult && (
        <div className={`mt-4 p-4 rounded border ${
          validationResult.valid
            ? 'bg-green-900/20 border-green-700'
            : 'bg-red-900/20 border-red-700'
        }`}>
          <h4 className={`font-semibold mb-2 ${validationResult.valid ? 'text-green-400' : 'text-red-400'}`}>
            Tier 1: {validationResult.valid ? '✅ Passed' : '❌ Failed'}
          </h4>

          {validationResult.failures.length > 0 && (
            <ul className="text-sm text-red-300 space-y-1">
              {validationResult.failures.map((f, i) => (
                <li key={i}>• {f.reason}</li>
              ))}
            </ul>
          )}

          {validationResult.warnings.length > 0 && (
            <ul className="text-sm text-yellow-300 mt-2 space-y-1">
              {validationResult.warnings.map((w, i) => (
                <li key={i}>⚠️ {w}</li>
              ))}
            </ul>
          )}

          <div className="mt-2 text-gray-400 text-sm">
            Complexity score: {validationResult.complexity}
          </div>
        </div>
      )}

      {/* Run anchor tests button */}
      {validationResult?.valid && !fullValidation && (
        <button
          onClick={handleRunTests}
          disabled={isValidating}
          className="mt-4 w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800
            text-white rounded font-medium transition-colors"
        >
          {isValidating ? testProgress : 'Run Anchor Tests (Tier 2)'}
        </button>
      )}

      {/* Full validation results */}
      {fullValidation && (
        <div className={`mt-4 p-4 rounded border ${
          fullValidation.eligible
            ? 'bg-green-900/20 border-green-700'
            : 'bg-yellow-900/20 border-yellow-700'
        }`}>
          <h4 className={`font-semibold mb-2 ${
            fullValidation.eligible ? 'text-green-400' : 'text-yellow-400'
          }`}>
            {fullValidation.summary}
          </h4>

          <div className="space-y-2 mt-3">
            {fullValidation.tier2.results.map((r) => (
              <div key={r.testId} className="flex items-start gap-2 text-sm">
                <span>{r.passed ? '✅' : '❌'}</span>
                <div>
                  <span className={r.passed ? 'text-green-300' : 'text-red-300'}>
                    {r.testName}
                  </span>
                  <p className="text-gray-500 text-xs">{r.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share to leaderboard button */}
      {fullValidation && !shared && (
        <div className="mt-4">
          <button
            onClick={handleShare}
            disabled={!fullValidation.eligible}
            className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600
              text-white rounded font-medium transition-colors"
          >
            {fullValidation.eligible ? 'Share to Leaderboard' : 'Not eligible (need 4+ anchors)'}
          </button>
          {shareError && (
            <div className="text-red-400 text-sm mt-2">{shareError}</div>
          )}
        </div>
      )}

      {/* Share success message */}
      {shared && (
        <div className="mt-4 p-3 bg-green-900/30 rounded border border-green-700">
          <span className="text-green-400">✓ Model shared to leaderboard!</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={!validationResult?.valid}
          className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600
            disabled:cursor-not-allowed text-white rounded font-medium"
        >
          Apply Model
        </button>
      </div>
    </div>
  );
};

export default ModelUpload;

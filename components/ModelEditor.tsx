/**
 * ModelEditor Component (P8-T11 + P9-T8)
 *
 * A real equation editor for the five equations simulation/pure.ts's stepSimulationPure
 * actually executes when a custom model is active (aiAdoptionGrowth, surplusGeneration,
 * wellbeingDelta, displacementFriction, ubiUtility - see modelEditorState.ts). Each field
 * gets live parse validation (via the sandboxed mathParser, same one the engine compiles
 * equations with) and a per-equation reset-to-default. A "Run Simulation" button applies
 * the edited model and re-simulates it live in the main view.
 *
 * Also hosts scenario sharing (P9-T8): export the current scenario (parameters + custom
 * equations) as a JSON file, import one back, and a copyable URL that encodes the scenario
 * in the `#scenario=` hash - separate from App.tsx's existing `#share=` link, which only
 * ever encoded the simple numeric ModelParameters dial preset.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EquationSet, ModelConfig } from '../types';
import { saveModel, modelNameExists } from '../src/services/modelStorage';
import { runFullValidation, FullValidationResult } from '../validation/testRunner';
import { getEquationDocumentation, ALLOWED_VARIABLES as getAllowedVariables, ALLOWED_FUNCTIONS as getAllowedFunctions } from '../src/services/equationParser';
import {
  EDITABLE_EQUATION_FIELDS,
  EquationValidationMap,
  validateAllEquationFields,
  validateEquationField,
  allFieldsValid,
  initEquationsForEditor,
  resetFieldToDefault,
  buildModelConfigFromEditor
} from '../src/services/modelEditorState';
import {
  exportScenarioJson,
  parseScenarioJson,
  buildScenarioShareUrl,
  decodeScenarioFromUrl,
  extractScenarioHashParam,
  scenarioFileName,
  ScenarioParseError
} from '../src/services/scenarioShare';

interface ModelEditorProps {
  initialConfig: ModelConfig | null;
  /** Apply this model to the running simulation (stays on the current tab). */
  onSave: (config: ModelConfig) => void;
  /** Apply this model AND re-simulate: the parent switches to the live view and plays. */
  onRun: (config: ModelConfig) => void;
  onCancel: () => void;
  /** Run the anchor-test suite against this model's own compiled equations. */
  onRunTests: (config: ModelConfig) => void;
}

const FIELD_LABELS: Record<keyof EquationSet, string> = {
  aiAdoptionGrowth: 'AI Adoption Growth',
  surplusGeneration: 'Corporation Surplus Generation',
  wellbeingDelta: 'Monthly Wellbeing Delta',
  displacementFriction: 'Displacement Friction',
  ubiUtility: 'UBI → Wellbeing Utility',
  demandCollapse: 'Demand Collapse Projection',
  reputationChange: 'Reputation Change',
  giniDamping: 'Gini Damping'
};

export const ModelEditor: React.FC<ModelEditorProps> = ({
  initialConfig,
  onSave,
  onRun,
  onCancel,
  onRunTests
}) => {
  const [name, setName] = useState(initialConfig?.name || '');
  const [description, setDescription] = useState(initialConfig?.description || '');
  const [baseConfig, setBaseConfig] = useState<ModelConfig | null>(initialConfig);
  const [equations, setEquations] = useState<EquationSet>(() => initEquationsForEditor(initialConfig));
  const [validationMap, setValidationMap] = useState<EquationValidationMap>(() =>
    validateAllEquationFields(initEquationsForEditor(initialConfig))
  );

  const [validationResult, setValidationResult] = useState<FullValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [shared, setShared] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allValid = useMemo(() => allFieldsValid(validationMap), [validationMap]);

  // Load a scenario from a `#scenario=` share link on first mount, then consume the hash
  // so re-opening this tab (or switching Upload/Edit) doesn't silently reapply it again.
  useEffect(() => {
    const param = extractScenarioHashParam(window.location.hash);
    if (!param) return;
    try {
      const config = decodeScenarioFromUrl(param);
      const merged = initEquationsForEditor(config);
      setBaseConfig(config);
      setName(config.name);
      setDescription(config.description);
      setEquations(merged);
      setValidationMap(validateAllEquationFields(merged));
      setValidationResult(null);
      setImportNotice(`Loaded "${config.name}" from a shared link - review the equations below, then Save or Run.`);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (err) {
      setImportError(err instanceof ScenarioParseError ? err.message : 'Failed to load scenario from link');
    }
    // Only ever consume the hash once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildConfig = useCallback(
    (): ModelConfig => buildModelConfigFromEditor({ existing: baseConfig, name, description, equations }),
    [baseConfig, name, description, equations]
  );

  const updateEquation = useCallback((field: keyof EquationSet, value: string) => {
    setEquations(prev => ({ ...prev, [field]: value }));
    setValidationMap(prev => ({ ...prev, [field]: validateEquationField(value) }));
    setValidationResult(null);
    setShared(false);
  }, []);

  const handleResetField = useCallback(
    (field: keyof EquationSet) => updateEquation(field, resetFieldToDefault(field)),
    [updateEquation]
  );

  // Run the anchor-test suite (Tier 2) against this model's own equations.
  const handleRunTests = useCallback(async () => {
    if (!allValid) return;
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
  }, [allValid, buildConfig, onRunTests]);

  // Apply this model to the running simulation without leaving this tab.
  const handleSave = useCallback(() => {
    if (!allValid) return;
    onSave(buildConfig());
  }, [allValid, buildConfig, onSave]);

  // Apply this model AND re-simulate it live.
  const handleRunSimulation = useCallback(() => {
    if (!allValid) return;
    onRun(buildConfig());
  }, [allValid, buildConfig, onRun]);

  const handleShare = useCallback(() => {
    if (!validationResult || validationResult.tier2.passed < 4) return;
    const config = buildConfig();
    if (modelNameExists(config.name)) {
      setShareError('A model with this name already exists');
      return;
    }
    try {
      saveModel(config, validationResult.tier2.results, true);
      setShared(true);
      setShareError(null);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Failed to share');
    }
  }, [validationResult, buildConfig]);

  // --- P9-T8: export / import / share-link -------------------------------------------

  const handleExport = useCallback(() => {
    const config = buildConfig();
    const json = exportScenarioJson(config);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = scenarioFileName(config);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [buildConfig]);

  const applyImportedConfig = useCallback((config: ModelConfig, noticePrefix: string) => {
    const merged = initEquationsForEditor(config);
    setBaseConfig(config);
    setName(config.name);
    setDescription(config.description);
    setEquations(merged);
    setValidationMap(validateAllEquationFields(merged));
    setValidationResult(null);
    setShared(false);
    setImportError(null);
    setImportNotice(`${noticePrefix} "${config.name}" - review the equations below, then Save or Run.`);
  }, []);

  const handleImportFile = useCallback(
    async (file: File) => {
      setImportError(null);
      setImportNotice(null);
      try {
        const text = await file.text();
        const config = parseScenarioJson(text);
        applyImportedConfig(config, 'Imported');
      } catch (err) {
        setImportError(err instanceof ScenarioParseError ? err.message : 'Failed to import scenario file');
      }
    },
    [applyImportedConfig]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleImportFile(file);
      e.target.value = '';
    },
    [handleImportFile]
  );

  const handleGenerateLink = useCallback(() => {
    const config = buildConfig();
    const url = buildScenarioShareUrl(config, window.location.origin, window.location.pathname);
    setShareUrl(url);
    setCopyFeedback(null);
  }, [buildConfig]);

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyFeedback('Copied!');
    } catch {
      setCopyFeedback('Copy failed - select and copy the link manually');
    }
  }, [shareUrl]);

  const allowedVariables = useMemo(() => getAllowedVariables(), []);
  const allowedFunctions = useMemo(() => getAllowedFunctions(), []);

  return (
    <div className="bg-gray-800 rounded-lg p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-white mb-4">
        {baseConfig ? 'Edit Model' : 'Create New Model'}
      </h2>

      {importNotice && (
        <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded text-blue-300 text-sm">
          {importNotice}
        </div>
      )}
      {importError && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
          {importError}
        </div>
      )}

      {/* Name / description */}
      <div className="space-y-4">
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">Model Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            placeholder="My Custom Model"
          />
        </div>
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            placeholder="Describe your model..."
          />
        </div>
      </div>

      {/* Equation editor (P8-T11) */}
      <div className="mt-6">
        <h3 className="text-white font-semibold mb-1">Equations</h3>
        <p className="text-gray-500 text-xs mb-4">
          These are the equations the simulation engine executes for a custom model, every month.
          Allowed variables: <span className="text-gray-400">{allowedVariables.join(', ')}</span>.
          Allowed functions: <span className="text-gray-400">{allowedFunctions.join(', ')}</span>.
        </p>

        <div className="space-y-5">
          {EDITABLE_EQUATION_FIELDS.map(field => {
            const validation = validationMap[field];
            const doc = getEquationDocumentation(field);
            return (
              <div key={field} data-testid={`equation-field-${field}`}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-200 text-sm font-medium">{FIELD_LABELS[field]}</label>
                  <button
                    type="button"
                    onClick={() => handleResetField(field)}
                    className="text-xs text-gray-400 hover:text-white underline"
                  >
                    Reset to default
                  </button>
                </div>
                <p className="text-gray-500 text-xs mb-1">{doc.description}</p>
                <textarea
                  value={equations[field] || ''}
                  onChange={e => updateEquation(field, e.target.value)}
                  rows={2}
                  spellCheck={false}
                  className={`w-full px-3 py-2 bg-gray-900 border rounded text-white font-mono text-sm ${
                    validation?.valid === false ? 'border-red-600' : 'border-gray-600'
                  }`}
                />
                {validation?.valid === false ? (
                  <p className="text-red-400 text-xs mt-1" data-testid={`equation-error-${field}`}>
                    {validation.error}
                  </p>
                ) : (
                  <p className="text-green-500 text-xs mt-1">Valid</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Overall equation-set status */}
      <div className={`mt-4 p-3 rounded text-sm ${allValid ? 'bg-green-900/20 text-green-400' : 'bg-yellow-900/20 text-yellow-400'}`}>
        {allValid
          ? 'All equations parse correctly - ready to save, run, or test.'
          : 'Fix the equation errors above before saving, running, or testing.'}
      </div>

      {/* Anchor-test validation results */}
      {validationResult && (
        <div
          className={`mt-4 p-4 rounded border ${
            validationResult.eligible ? 'bg-green-900/20 border-green-700' : 'bg-yellow-900/20 border-yellow-700'
          }`}
        >
          <h4 className={`font-semibold mb-2 ${validationResult.eligible ? 'text-green-400' : 'text-yellow-400'}`}>
            {validationResult.summary}
          </h4>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={onCancel}
          className="flex-1 min-w-[100px] py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded font-medium"
        >
          Close
        </button>
        <button
          onClick={handleSave}
          disabled={!allValid}
          className="flex-1 min-w-[100px] py-2 px-4 bg-slate-600 hover:bg-slate-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-medium"
        >
          Save
        </button>
        <button
          onClick={handleRunSimulation}
          disabled={!allValid}
          className="flex-1 min-w-[130px] py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-medium"
        >
          Run Simulation
        </button>
        <button
          onClick={handleRunTests}
          disabled={!allValid || isValidating}
          className="flex-1 min-w-[130px] py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:text-gray-400 text-white rounded font-medium"
        >
          {isValidating ? 'Running Tests...' : 'Run Anchor Tests'}
        </button>
        {validationResult && validationResult.eligible && !shared && (
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium"
          >
            Share to Leaderboard
          </button>
        )}
        {shared && <span className="text-green-400 flex items-center">✓ Shared!</span>}
      </div>
      {shareError && <div className="mt-2 text-red-400 text-sm">{shareError}</div>}

      {/* P9-T8: export / import / share link */}
      <div className="mt-8 pt-6 border-t border-gray-700">
        <h3 className="text-white font-semibold mb-3">Share &amp; Export Scenario</h3>
        <p className="text-gray-500 text-xs mb-3">
          A scenario is this model's parameters plus its equations - export it as a file, import one back, or
          copy a link that encodes it.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExport}
            className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium text-sm"
          >
            Export as JSON
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium text-sm"
          >
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <button
            onClick={handleGenerateLink}
            className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium text-sm"
          >
            Generate Share Link
          </button>
        </div>

        {shareUrl && (
          <div className="mt-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <input
              type="text"
              readOnly
              value={shareUrl}
              onFocus={e => e.target.select()}
              className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-300 text-xs font-mono"
            />
            <button
              onClick={handleCopyLink}
              className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm whitespace-nowrap"
            >
              Copy Link
            </button>
          </div>
        )}
        {copyFeedback && <p className="text-xs text-gray-400 mt-1">{copyFeedback}</p>}
      </div>
    </div>
  );
};

export default ModelEditor;

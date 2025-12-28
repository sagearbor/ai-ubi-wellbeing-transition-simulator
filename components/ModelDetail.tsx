/**
 * ModelDetail Component
 * Modal showing full model details, equations, test results, and run history
 */

import React, { useState, useEffect } from 'react';
import { StoredModel, RunRecord } from '../types';
import { getRunHistory } from '../src/services/modelStorage';
import { getComplexityTier, calculateComplexityBreakdown } from '../src/services/complexityScorer';

interface ModelDetailProps {
  model: StoredModel;
  onClose: () => void;
  onApply: (model: StoredModel) => void;
  onRate: (modelId: string, rating: number) => void;
}

export const ModelDetail: React.FC<ModelDetailProps> = ({
  model,
  onClose,
  onApply,
  onRate
}) => {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'equations' | 'tests' | 'runs'>('overview');
  const [userRating, setUserRating] = useState(0);

  useEffect(() => {
    setRuns(getRunHistory(model.id, 20));
  }, [model.id]);

  const tier = getComplexityTier(model.complexity);
  const breakdown = calculateComplexityBreakdown(model.modelConfig);

  // Download single model as JSON
  const handleDownload = () => {
    const data = JSON.stringify(model.modelConfig, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${model.modelConfig.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-white">{model.modelConfig.name}</h2>
            <p className="text-gray-400 text-sm">
              by {model.modelConfig.metadata.author} • v{model.modelConfig.metadata.version}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {(['overview', 'equations', 'tests', 'runs'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize ${
                activeTab === tab
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Description */}
              <div>
                <h3 className="text-gray-400 text-sm mb-1">Description</h3>
                <p className="text-white">{model.modelConfig.description}</p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-700/50 rounded p-3">
                  <div className="text-gray-400 text-xs">Anchors Passed</div>
                  <div className={`text-2xl font-bold ${model.anchorTestsPassed >= 4 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {model.anchorTestsPassed}/6
                  </div>
                </div>
                <div className="bg-gray-700/50 rounded p-3">
                  <div className="text-gray-400 text-xs">Complexity</div>
                  <div className={`text-2xl font-bold ${tier.color}`}>
                    {model.complexity}
                  </div>
                  <div className="text-xs text-gray-500">{tier.label}</div>
                </div>
                <div className="bg-gray-700/50 rounded p-3">
                  <div className="text-gray-400 text-xs">Total Runs</div>
                  <div className="text-2xl font-bold text-white">{model.runCount}</div>
                </div>
                <div className="bg-gray-700/50 rounded p-3">
                  <div className="text-gray-400 text-xs">Avg Wellbeing</div>
                  <div className="text-2xl font-bold text-white">
                    {model.runCount > 0 ? model.avgWellbeing.toFixed(1) : '-'}
                  </div>
                </div>
              </div>

              {/* Complexity breakdown */}
              <div>
                <h3 className="text-gray-400 text-sm mb-2">Complexity Breakdown</h3>
                <div className="bg-gray-700/30 rounded p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Parameters ({breakdown.parameterCount})</span>
                    <span className="text-white">+{breakdown.parameterScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Equation length ({breakdown.totalEquationLength} chars)</span>
                    <span className="text-white">+{breakdown.equationLengthScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Operations ({breakdown.totalOperations})</span>
                    <span className="text-white">+{breakdown.operationScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max nesting ({breakdown.maxNestingDepth})</span>
                    <span className="text-white">+{breakdown.nestingScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Optional equations ({breakdown.optionalEquationsUsed})</span>
                    <span className="text-white">+{breakdown.optionalEquationScore}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-600 pt-1 mt-1">
                    <span className="text-white font-medium">Total</span>
                    <span className={`font-bold ${tier.color}`}>{breakdown.total}</span>
                  </div>
                </div>
              </div>

              {/* Rating */}
              <div>
                <h3 className="text-gray-400 text-sm mb-2">Rate this model</h3>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => {
                        setUserRating(star);
                        onRate(model.id, star);
                      }}
                      className={`text-2xl ${
                        star <= (userRating || model.rating)
                          ? 'text-yellow-400'
                          : 'text-gray-600'
                      } hover:text-yellow-300`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="text-gray-400 ml-2">
                    ({model.ratingCount} ratings)
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'equations' && (
            <div className="space-y-3">
              {Object.entries(model.modelConfig.equations).map(([name, equation]) => (
                equation && (
                  <div key={name} className="bg-gray-700/30 rounded p-3">
                    <div className="text-blue-400 text-sm font-medium mb-1">{name}</div>
                    <code className="text-green-400 text-sm font-mono break-all">{equation}</code>
                  </div>
                )
              ))}
            </div>
          )}

          {activeTab === 'tests' && (
            <div className="space-y-2">
              {model.anchorTestResults.map(result => (
                <div
                  key={result.testId}
                  className={`p-3 rounded border ${
                    result.passed
                      ? 'bg-green-900/20 border-green-700'
                      : 'bg-red-900/20 border-red-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{result.passed ? '✅' : '❌'}</span>
                    <span className={result.passed ? 'text-green-400' : 'text-red-400'}>
                      {result.testName}
                    </span>
                    <span className="text-gray-500 text-xs">({result.category})</span>
                  </div>
                  <p className="text-gray-400 text-sm mt-1">{result.reason}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'runs' && (
            <div>
              {runs.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No runs recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {runs.map(run => (
                    <div key={run.id} className="bg-gray-700/30 rounded p-3 text-sm">
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-400">
                          {new Date(run.runAt).toLocaleString()}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          run.gameTheoryOutcome === 'virtuous-cycle' ? 'bg-green-700 text-green-200' :
                          run.gameTheoryOutcome === 'race-to-bottom' ? 'bg-red-700 text-red-200' :
                          'bg-yellow-700 text-yellow-200'
                        }`}>
                          {run.gameTheoryOutcome}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Wellbeing: </span>
                          <span className="text-white">{run.finalWellbeing.toFixed(1)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Fund: </span>
                          <span className="text-white">${(run.finalFundSize / 1000).toFixed(1)}B</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Month: </span>
                          <span className="text-white">{run.finalMonth}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex gap-3">
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
          >
            Download JSON
          </button>
          <button
            onClick={() => onApply(model)}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium"
          >
            Apply Model
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModelDetail;

/**
 * Leaderboard Component
 * Shows community models ranked by complexity (simpler = higher rank)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LeaderboardEntry, LeaderboardFilter, LeaderboardSort, StoredModel } from '../types';
import { getLeaderboard, getModel } from '../src/services/modelStorage';
import { getComplexityTier } from '../src/services/complexityScorer';

interface LeaderboardProps {
  onApplyModel: (model: StoredModel) => void;
  onViewDetails: (model: StoredModel) => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ onApplyModel, onViewDetails }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<LeaderboardSort>('rank');
  const [filter, setFilter] = useState<LeaderboardFilter>({ onlyEligible: true });
  const [showAllModels, setShowAllModels] = useState(false);

  // Load leaderboard data
  const loadLeaderboard = useCallback(() => {
    setLoading(true);
    try {
      const data = getLeaderboard(100, showAllModels ? {} : filter);
      setEntries(data);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    }
    setLoading(false);
  }, [filter, showAllModels]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  // Handle apply model
  const handleApply = useCallback((modelId: string) => {
    const model = getModel(modelId);
    if (model) {
      onApplyModel(model);
    }
  }, [onApplyModel]);

  // Handle view details
  const handleViewDetails = useCallback((modelId: string) => {
    const model = getModel(modelId);
    if (model) {
      onViewDetails(model);
    }
  }, [onViewDetails]);

  // Sort handler
  const handleSort = (column: LeaderboardSort) => {
    setSortBy(column);
    // Re-sort entries
    const sorted = [...entries].sort((a, b) => {
      switch (column) {
        case 'rank': return a.complexity - b.complexity;
        case 'newest': return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
        case 'mostRuns': return b.runCount - a.runCount;
        case 'highestRating': return b.rating - a.rating;
        case 'bestWellbeing': return b.avgWellbeing - a.avgWellbeing;
        default: return 0;
      }
    });
    setEntries(sorted);
  };

  // Column header with sort indicator
  const SortHeader: React.FC<{ column: LeaderboardSort; label: string; className?: string }> =
    ({ column, label, className }) => (
      <th
        className={`px-3 py-2 text-left cursor-pointer hover:bg-gray-700 ${className || ''}`}
        onClick={() => handleSort(column)}
      >
        {label} {sortBy === column && '▼'}
      </th>
    );

  if (loading) {
    return <div className="text-gray-400 p-4">Loading leaderboard...</div>;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Model Leaderboard</h2>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={!showAllModels}
              onChange={(e) => setShowAllModels(!e.target.checked)}
              className="rounded"
            />
            Eligible only (4+ anchors)
          </label>
          <button
            onClick={loadLeaderboard}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Empty state */}
      {entries.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg mb-2">No models on the leaderboard yet</p>
          <p className="text-sm">Upload a model and share it to appear here!</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-gray-400 border-b border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left w-12">#</th>
                <SortHeader column="rank" label="Model" className="min-w-[200px]" />
                <th className="px-3 py-2 text-left">Author</th>
                <th className="px-3 py-2 text-center">Anchors</th>
                <SortHeader column="rank" label="Complexity" />
                <SortHeader column="bestWellbeing" label="Avg Wellbeing" />
                <SortHeader column="mostRuns" label="Runs" />
                <SortHeader column="highestRating" label="Rating" />
                <th className="px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const tier = getComplexityTier(entry.complexity);
                return (
                  <tr
                    key={entry.modelId}
                    className="border-b border-gray-700/50 hover:bg-gray-700/30"
                  >
                    {/* Rank */}
                    <td className="px-3 py-3 text-gray-500 font-mono">
                      {entry.isEligible ? entry.rank : '-'}
                    </td>

                    {/* Model name */}
                    <td className="px-3 py-3">
                      <button
                        onClick={() => handleViewDetails(entry.modelId)}
                        className="text-blue-400 hover:text-blue-300 font-medium text-left"
                      >
                        {entry.modelName}
                      </button>
                    </td>

                    {/* Author */}
                    <td className="px-3 py-3 text-gray-400">
                      {entry.author}
                    </td>

                    {/* Anchors passed */}
                    <td className="px-3 py-3 text-center">
                      <span className={entry.isEligible ? 'text-green-400' : 'text-yellow-400'}>
                        {entry.anchorsPassed}/{entry.anchorsTotal}
                      </span>
                    </td>

                    {/* Complexity */}
                    <td className="px-3 py-3">
                      <span className={tier.color}>{entry.complexity}</span>
                      <span className="text-gray-500 text-xs ml-1">({tier.label})</span>
                    </td>

                    {/* Avg wellbeing */}
                    <td className="px-3 py-3 text-gray-300">
                      {entry.runCount > 0 ? entry.avgWellbeing.toFixed(1) : '-'}
                    </td>

                    {/* Run count */}
                    <td className="px-3 py-3 text-gray-400">
                      {entry.runCount}
                    </td>

                    {/* Rating */}
                    <td className="px-3 py-3 text-yellow-400">
                      {entry.rating > 0 ? `${entry.rating.toFixed(1)}★` : '-'}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => handleApply(entry.modelId)}
                        className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                      >
                        Apply
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer stats */}
      <div className="mt-4 text-xs text-gray-500 flex justify-between">
        <span>{entries.length} models shown</span>
        <span>Ranked by complexity (simpler = higher rank)</span>
      </div>
    </div>
  );
};

export default Leaderboard;

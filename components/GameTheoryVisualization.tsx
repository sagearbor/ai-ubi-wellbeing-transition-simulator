import React from 'react';
import { Corporation, GameTheoryState } from '../types';

interface GameTheoryVisualizationProps {
  gameTheoryState: GameTheoryState;
  corporations: Corporation[];
}

const GameTheoryVisualization: React.FC<GameTheoryVisualizationProps> = ({
  gameTheoryState,
  corporations,
}) => {
  // Calculate strategy distribution
  const strategyBreakdown = {
    global: corporations.filter(c => c.distributionStrategy === 'global').length,
    customerWeighted: corporations.filter(c => c.distributionStrategy === 'customer-weighted').length,
    hqLocal: corporations.filter(c => c.distributionStrategy === 'hq-local').length,
  };

  const total = corporations.length;
  const strategyPercentages = {
    global: total > 0 ? (strategyBreakdown.global / total) * 100 : 0,
    customerWeighted: total > 0 ? (strategyBreakdown.customerWeighted / total) * 100 : 0,
    hqLocal: total > 0 ? (strategyBreakdown.hqLocal / total) * 100 : 0,
  };

  // Calculate contribution histogram bins
  const bins = [
    { min: 0.05, max: 0.10, label: '5-10%' },
    { min: 0.10, max: 0.15, label: '10-15%' },
    { min: 0.15, max: 0.20, label: '15-20%' },
    { min: 0.20, max: 0.25, label: '20-25%' },
    { min: 0.25, max: 0.30, label: '25-30%' },
    { min: 0.30, max: 0.40, label: '30-40%' },
    { min: 0.40, max: 0.50, label: '40-50%' },
  ];

  const histogram = bins.map((bin, idx) => ({
    ...bin,
    // Use <= for the last bin to include the max value (e.g., 0.50), < for others
    count: corporations.filter(c =>
      c.contributionRate >= bin.min &&
      (idx === bins.length - 1 ? c.contributionRate <= bin.max : c.contributionRate < bin.max)
    ).length,
  }));

  const maxCount = Math.max(...histogram.map(h => h.count), 1);

  // Cooperation meter position (0-100, where 0 is left/red, 100 is right/green)
  const cooperationScore = gameTheoryState.virtuousCycleStrength > 0
    ? 50 + (gameTheoryState.virtuousCycleStrength * 50)
    : 50 - (gameTheoryState.raceToBottomRisk * 50);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Game Theory Dynamics</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Visualizing cooperation patterns, distribution strategies, and collective action dynamics across corporations
        </p>
      </div>

      {/* Status Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {gameTheoryState.virtuousCycleStrength > 0.5 && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-400 dark:border-emerald-600 rounded-xl p-4 flex items-center gap-3">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
            <div>
              <div className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">Virtuous Cycle Active</div>
              <div className="text-emerald-600 dark:text-emerald-500 text-xs">Cooperation is reinforcing itself</div>
            </div>
          </div>
        )}

        {gameTheoryState.raceToBottomRisk > 0.5 && (
          <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-400 dark:border-rose-600 rounded-xl p-4 flex items-center gap-3">
            <div className="w-3 h-3 bg-rose-500 rounded-full animate-pulse" />
            <div>
              <div className="text-rose-700 dark:text-rose-400 font-bold text-sm">Race to Bottom Risk</div>
              <div className="text-rose-600 dark:text-rose-500 text-xs">Defection pressure is mounting</div>
            </div>
          </div>
        )}

        {gameTheoryState.isInPrisonersDilemma && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-400 dark:border-amber-600 rounded-xl p-4 flex items-center gap-3">
            <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
            <div>
              <div className="text-amber-700 dark:text-amber-400 font-bold text-sm">Prisoner's Dilemma</div>
              <div className="text-amber-600 dark:text-amber-500 text-xs">Tension between self-interest and cooperation</div>
            </div>
          </div>
        )}
      </div>

      {/* Cooperation Meter */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-widest">
          Cooperation Meter
        </h3>

        {/* Gauge Container */}
        <div className="relative h-20 mb-2">
          {/* Background gradient bar */}
          <div className="absolute top-1/2 -translate-y-1/2 w-full h-8 rounded-full overflow-hidden flex">
            <div className="flex-1 bg-gradient-to-r from-rose-500 to-rose-400" />
            <div className="flex-1 bg-gradient-to-r from-rose-400 to-amber-400" />
            <div className="flex-1 bg-gradient-to-r from-amber-400 to-emerald-400" />
            <div className="flex-1 bg-gradient-to-r from-emerald-400 to-emerald-500" />
          </div>

          {/* Zone Labels */}
          <div className="absolute top-0 w-full flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            <span>Race to Bottom</span>
            <span className="text-amber-600 dark:text-amber-400">Prisoner's Dilemma</span>
            <span className="text-emerald-600 dark:text-emerald-400">Virtuous Cycle</span>
          </div>

          {/* Current Position Marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
            style={{ left: `${cooperationScore}%` }}
          >
            <div className="relative -translate-x-1/2">
              <div className="w-1 h-12 bg-white dark:bg-slate-200 rounded-full shadow-lg" />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 dark:bg-white text-white dark:text-slate-800 px-2 py-1 rounded text-xs font-bold whitespace-nowrap shadow-lg">
                {cooperationScore.toFixed(0)}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-2 text-xs mt-6">
          <div className="text-center">
            <div className="font-bold text-rose-600 dark:text-rose-400">0-33</div>
            <div className="text-slate-500 dark:text-slate-400">Defection</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-amber-600 dark:text-amber-400">34-66</div>
            <div className="text-slate-500 dark:text-slate-400">Tension</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-emerald-600 dark:text-emerald-400">67-100</div>
            <div className="text-slate-500 dark:text-slate-400">Cooperation</div>
          </div>
        </div>
      </div>

      {/* Strategy Breakdown and Contribution Histogram */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strategy Breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-widest">
            Distribution Strategy Breakdown
          </h3>

          {/* Bar Chart */}
          <div className="space-y-3 mb-6">
            {/* Global */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Global</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{strategyPercentages.global.toFixed(1)}%</span>
              </div>
              <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${strategyPercentages.global}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-1">
                {strategyBreakdown.global} corporations
              </div>
            </div>

            {/* Customer-Weighted */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Customer-Weighted</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">{strategyPercentages.customerWeighted.toFixed(1)}%</span>
              </div>
              <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
                  style={{ width: `${strategyPercentages.customerWeighted}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-1">
                {strategyBreakdown.customerWeighted} corporations
              </div>
            </div>

            {/* HQ-Local */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 dark:text-slate-400 font-medium">HQ-Local</span>
                <span className="text-orange-600 dark:text-orange-400 font-bold">{strategyPercentages.hqLocal.toFixed(1)}%</span>
              </div>
              <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-500"
                  style={{ width: `${strategyPercentages.hqLocal}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-1">
                {strategyBreakdown.hqLocal} corporations
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-sm mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-slate-700 dark:text-slate-300">Global</div>
                <div className="text-slate-500 dark:text-slate-400 text-[10px]">Equal distribution to all humans</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-sm mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-slate-700 dark:text-slate-300">Customer-Weighted</div>
                <div className="text-slate-500 dark:text-slate-400 text-[10px]">Proportional to customer base</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-sm mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-slate-700 dark:text-slate-300">HQ-Local</div>
                <div className="text-slate-500 dark:text-slate-400 text-[10px]">Only to headquarters country</div>
              </div>
            </div>
          </div>
        </div>

        {/* Contribution Histogram */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-widest">
            Contribution Rate Distribution
          </h3>

          {/* Histogram */}
          <div className="h-48 flex items-end gap-2 mb-4">
            {histogram.map((bin, idx) => {
              const height = (bin.count / maxCount) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg overflow-hidden relative" style={{ height: '100%' }}>
                    <div
                      className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 absolute bottom-0 transition-all duration-500 rounded-t-lg flex items-start justify-center pt-1"
                      style={{ height: `${height}%` }}
                    >
                      {bin.count > 0 && (
                        <span className="text-[10px] font-bold text-white">{bin.count}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400 font-medium text-center rotate-[-45deg] origin-top-left mt-2">
                    {bin.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Axes Labels */}
          <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="text-xs text-slate-600 dark:text-slate-400 text-center font-medium mb-2">
              Contribution Rate (% of AI Revenue)
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-500 text-center">
              Shows clustering patterns - are corporations cooperating or defecting?
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-widest">
          Game Theory Summary
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {gameTheoryState.cooperationCount}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cooperating</div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {gameTheoryState.moderateCount}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Moderate</div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {gameTheoryState.defectionCount}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Defecting</div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {(gameTheoryState.avgContributionRate * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Avg Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameTheoryVisualization;

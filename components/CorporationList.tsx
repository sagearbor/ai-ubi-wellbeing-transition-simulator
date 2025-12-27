
import React, { useState, useMemo } from 'react';
import { ArrowUpDown, Search, Filter, TrendingUp, Building2, Globe2, CheckSquare, Square } from 'lucide-react';
import { Corporation } from '../types';

interface CorporationListProps {
  corporations: Corporation[];
  selectedCorpId: string | null;
  onSelectCorp: (id: string) => void;
  selectedCorpIds: Set<string>;
  onToggleCorpSelection: (id: string) => void;
  onSelectAllCorps: (filter: 'us' | 'eu' | 'all' | 'clear') => void;
  onBulkUpdateContribution: (newRate: number) => void;
}

type SortField = 'name' | 'hqCountry' | 'aiRevenue' | 'contributionRate' | 'strategy' | 'stance';
type SortDirection = 'asc' | 'desc';

const CorporationList: React.FC<CorporationListProps> = ({
  corporations,
  selectedCorpId,
  onSelectCorp,
  selectedCorpIds,
  onToggleCorpSelection,
  onSelectAllCorps,
  onBulkUpdateContribution
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [filterStrategy, setFilterStrategy] = useState<string>('all');
  const [filterStance, setFilterStance] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('aiRevenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [bulkContributionRate, setBulkContributionRate] = useState(0.3);

  // Get unique countries
  const uniqueCountries = useMemo(() => {
    const countries = new Set(corporations.map(c => c.headquartersCountry));
    return Array.from(countries).sort();
  }, [corporations]);

  // Filter and sort corporations
  const filteredAndSortedCorps = useMemo(() => {
    let filtered = corporations.filter(corp => {
      // Search filter
      if (searchTerm && !corp.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      // Country filter
      if (filterCountry !== 'all' && corp.headquartersCountry !== filterCountry) {
        return false;
      }
      // Strategy filter
      if (filterStrategy !== 'all' && corp.distributionStrategy !== filterStrategy) {
        return false;
      }
      // Stance filter
      if (filterStance !== 'all' && corp.policyStance !== filterStance) {
        return false;
      }
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'hqCountry':
          aVal = a.headquartersCountry;
          bVal = b.headquartersCountry;
          break;
        case 'aiRevenue':
          aVal = a.aiRevenue;
          bVal = b.aiRevenue;
          break;
        case 'contributionRate':
          aVal = a.contributionRate;
          bVal = b.contributionRate;
          break;
        case 'strategy':
          aVal = a.distributionStrategy;
          bVal = b.distributionStrategy;
          break;
        case 'stance':
          aVal = a.policyStance;
          bVal = b.policyStance;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return sortDirection === 'asc'
          ? aVal - bVal
          : bVal - aVal;
      }
    });

    return filtered;
  }, [corporations, searchTerm, filterCountry, filterStrategy, filterStance, sortField, sortDirection]);

  // Calculate aggregate stats
  const stats = useMemo(() => {
    const totalContribution = corporations.reduce((sum, corp) =>
      sum + (corp.aiRevenue * corp.contributionRate), 0
    );

    const strategyCounts = {
      global: 0,
      'customer-weighted': 0,
      'hq-local': 0
    };

    corporations.forEach(corp => {
      strategyCounts[corp.distributionStrategy]++;
    });

    const totalCorps = corporations.length;
    const strategyPercentages = {
      global: (strategyCounts.global / totalCorps) * 100,
      'customer-weighted': (strategyCounts['customer-weighted'] / totalCorps) * 100,
      'hq-local': (strategyCounts['hq-local'] / totalCorps) * 100
    };

    // Top 5 contributors
    const topContributors = [...corporations]
      .sort((a, b) => (b.aiRevenue * b.contributionRate) - (a.aiRevenue * a.contributionRate))
      .slice(0, 5);

    return {
      totalContribution,
      strategyPercentages,
      topContributors
    };
  }, [corporations]);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Get stance color
  const getStanceColor = (stance: string) => {
    switch (stance) {
      case 'generous':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'selfish':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStanceBorderColor = (stance: string) => {
    switch (stance) {
      case 'generous':
        return 'border-l-green-500';
      case 'moderate':
        return 'border-l-yellow-500';
      case 'selfish':
        return 'border-l-red-500';
      default:
        return 'border-l-gray-400';
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 1) return `$${value.toFixed(1)}B`;
    return `$${(value * 1000).toFixed(0)}M`;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Aggregate Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        {/* Total Contributions */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm mb-1">
            <TrendingUp size={16} />
            <span>Total Corporate Contributions</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(stats.totalContribution)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            This month
          </div>
        </div>

        {/* Strategy Distribution */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm mb-2">
            <Globe2 size={16} />
            <span>Distribution Strategies</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">Global:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {stats.strategyPercentages.global.toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">Customer-Weighted:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {stats.strategyPercentages['customer-weighted'].toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">HQ-Local:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {stats.strategyPercentages['hq-local'].toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Top Contributors */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm mb-2">
            <Building2 size={16} />
            <span>Top 5 Contributors</span>
          </div>
          <div className="space-y-1">
            {stats.topContributors.map((corp, idx) => (
              <div key={corp.id} className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400 truncate">
                  {idx + 1}. {corp.name}
                </span>
                <span className="font-semibold text-slate-900 dark:text-white ml-2">
                  {formatCurrency(corp.aiRevenue * corp.contributionRate)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Country Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="all">All Countries</option>
              {uniqueCountries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>

          {/* Strategy Filter */}
          <select
            value={filterStrategy}
            onChange={(e) => setFilterStrategy(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
          >
            <option value="all">All Strategies</option>
            <option value="global">Global</option>
            <option value="customer-weighted">Customer-Weighted</option>
            <option value="hq-local">HQ-Local</option>
          </select>

          {/* Stance Filter */}
          <select
            value={filterStance}
            onChange={(e) => setFilterStance(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
          >
            <option value="all">All Stances</option>
            <option value="generous">Generous</option>
            <option value="moderate">Moderate</option>
            <option value="selfish">Selfish</option>
          </select>
        </div>

        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Showing {filteredAndSortedCorps.length} of {corporations.length} corporations
        </div>
      </div>

      {/* Bulk Selection and Edit Controls */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="flex flex-col gap-3">
          {/* Bulk Select Buttons */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 self-center">
              Quick Select:
            </span>
            <button
              onClick={() => onSelectAllCorps('us')}
              className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              All US Corps
            </button>
            <button
              onClick={() => onSelectAllCorps('eu')}
              className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              All EU Corps
            </button>
            <button
              onClick={() => onSelectAllCorps('all')}
              className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={() => onSelectAllCorps('clear')}
              className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Clear Selection
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400 self-center ml-2">
              {selectedCorpIds.size} selected
            </span>
          </div>

          {/* Bulk Edit Controls */}
          {selectedCorpIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <span className="text-xs font-semibold text-blue-900 dark:text-blue-100">
                Bulk Edit ({selectedCorpIds.size} corps):
              </span>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-700 dark:text-slate-300">
                  Contribution Rate:
                </label>
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.05"
                  value={bulkContributionRate}
                  onChange={(e) => setBulkContributionRate(parseFloat(e.target.value))}
                  className="w-32"
                />
                <span className="text-xs font-semibold text-slate-900 dark:text-white min-w-[3rem]">
                  {(bulkContributionRate * 100).toFixed(0)}%
                </span>
              </div>
              <button
                onClick={() => {
                  onBulkUpdateContribution(bulkContributionRate);
                  onSelectAllCorps('clear');
                }}
                className="px-4 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply to Selected
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10">
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-3 w-10">
                <div className="flex items-center justify-center">
                  {selectedCorpIds.size > 0 ? (
                    <CheckSquare size={16} className="text-blue-500" />
                  ) : (
                    <Square size={16} className="text-slate-400" />
                  )}
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Name
                  <ArrowUpDown size={12} className={sortField === 'name' ? 'text-blue-500' : 'text-slate-400'} />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                onClick={() => handleSort('hqCountry')}
              >
                <div className="flex items-center gap-1">
                  HQ Country
                  <ArrowUpDown size={12} className={sortField === 'hqCountry' ? 'text-blue-500' : 'text-slate-400'} />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                onClick={() => handleSort('aiRevenue')}
              >
                <div className="flex items-center justify-end gap-1">
                  AI Revenue
                  <ArrowUpDown size={12} className={sortField === 'aiRevenue' ? 'text-blue-500' : 'text-slate-400'} />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                onClick={() => handleSort('contributionRate')}
              >
                <div className="flex items-center justify-end gap-1">
                  Contribution Rate
                  <ArrowUpDown size={12} className={sortField === 'contributionRate' ? 'text-blue-500' : 'text-slate-400'} />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                onClick={() => handleSort('strategy')}
              >
                <div className="flex items-center gap-1">
                  Strategy
                  <ArrowUpDown size={12} className={sortField === 'strategy' ? 'text-blue-500' : 'text-slate-400'} />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                onClick={() => handleSort('stance')}
              >
                <div className="flex items-center gap-1">
                  Stance
                  <ArrowUpDown size={12} className={sortField === 'stance' ? 'text-blue-500' : 'text-slate-400'} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedCorps.map((corp) => {
              const isSelected = selectedCorpIds.has(corp.id);
              return (
                <tr
                  key={corp.id}
                  onClick={(e) => {
                    if (e.shiftKey) {
                      e.preventDefault();
                      onToggleCorpSelection(corp.id);
                    } else {
                      onSelectCorp(corp.id);
                    }
                  }}
                  className={`
                    border-b border-slate-100 dark:border-slate-800 border-l-4
                    ${getStanceBorderColor(corp.policyStance)}
                    ${isSelected
                      ? 'bg-blue-100 dark:bg-blue-900/30'
                      : selectedCorpId === corp.id
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }
                    cursor-pointer transition-colors
                  `}
                >
                  <td
                    className="px-4 py-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCorpSelection(corp.id);
                    }}
                  >
                    <div className="flex items-center justify-center">
                      {isSelected ? (
                        <CheckSquare size={16} className="text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Square size={16} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                    {corp.name}
                  </td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                  {corp.headquartersCountry}
                </td>
                <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(corp.aiRevenue)}
                </td>
                <td className="px-4 py-3 text-sm text-right text-slate-900 dark:text-white">
                  {(corp.contributionRate * 100).toFixed(0)}%
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                  <span className="capitalize">
                    {corp.distributionStrategy.replace('-', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-semibold capitalize ${getStanceColor(corp.policyStance)}`}>
                    {corp.policyStance}
                  </span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>

        {filteredAndSortedCorps.length === 0 && (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            No corporations match your filters
          </div>
        )}
      </div>
    </div>
  );
};

export default CorporationList;


import React, { useMemo } from 'react';
import { X, TrendingUp, TrendingDown, AlertTriangle, Globe2, Building2, Users, DollarSign } from 'lucide-react';
import { Corporation } from '../types';

interface CorporationDetailPanelProps {
  corporation: Corporation | null;
  onClose: () => void;
  onUpdateCorp: (id: string, updates: Partial<Corporation>) => void;
}

// Country flag emojis lookup
const COUNTRY_FLAGS: Record<string, string> = {
  usa: '🇺🇸',
  chn: '🇨🇳',
  jpn: '🇯🇵',
  deu: '🇩🇪',
  gbr: '🇬🇧',
  fra: '🇫🇷',
  ind: '🇮🇳',
  ita: '🇮🇹',
  bra: '🇧🇷',
  can: '🇨🇦',
  kor: '🇰🇷',
  rus: '🇷🇺',
  esp: '🇪🇸',
  aus: '🇦🇺',
  mex: '🇲🇽',
  idn: '🇮🇩',
  nld: '🇳🇱',
  sau: '🇸🇦',
  tur: '🇹🇷',
  che: '🇨🇭',
  pol: '🇵🇱',
  tha: '🇹🇭',
  bel: '🇧🇪',
  swe: '🇸🇪',
  nga: '🇳🇬',
  arg: '🇦🇷',
  aut: '🇦🇹',
  nor: '🇳🇴',
  are: '🇦🇪',
  isr: '🇮🇱',
  sgp: '🇸🇬',
  hkg: '🇭🇰',
  mys: '🇲🇾',
  dnk: '🇩🇰',
  phl: '🇵🇭',
  irl: '🇮🇪',
  egy: '🇪🇬',
  pak: '🇵🇰',
  vnm: '🇻🇳',
  col: '🇨🇴',
  bgd: '🇧🇩',
  chl: '🇨🇱',
  fin: '🇫🇮',
  prt: '🇵🇹',
  cze: '🇨🇿',
  per: '🇵🇪',
  nzl: '🇳🇿',
  grc: '🇬🇷',
  qat: '🇶🇦',
  irq: '🇮🇶',
};

const CorporationDetailPanel: React.FC<CorporationDetailPanelProps> = ({
  corporation,
  onClose,
  onUpdateCorp
}) => {
  // If no corporation selected, don't render
  if (!corporation) return null;

  // Get policy stance color
  const stanceColor = useMemo(() => {
    switch (corporation.policyStance) {
      case 'generous':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'moderate':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      case 'selfish':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30';
    }
  }, [corporation.policyStance]);

  // Get reputation color
  const reputationColor = useMemo(() => {
    if (corporation.reputationScore >= 80) return 'text-green-600 dark:text-green-400';
    if (corporation.reputationScore >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  }, [corporation.reputationScore]);

  // Get demand collapse warning color
  const demandCollapseColor = useMemo(() => {
    const collapse = corporation.projectedDemandCollapse || 0;
    if (collapse > 0.15) return 'text-red-600 dark:text-red-400';
    if (collapse > 0.08) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  }, [corporation.projectedDemandCollapse]);

  // Handle contribution rate change
  const handleContributionRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRate = parseFloat(e.target.value) / 100; // Convert from percentage
    onUpdateCorp(corporation.id, { contributionRate: newRate });
  };

  // Handle distribution strategy change
  const handleStrategyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStrategy = e.target.value as 'global' | 'customer-weighted' | 'hq-local';
    onUpdateCorp(corporation.id, { distributionStrategy: newStrategy });
  };

  // Format large numbers
  const formatBillions = (value: number) => {
    return `$${value.toFixed(2)}B`;
  };

  // Format percentage
  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(0)}%`;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white dark:bg-slate-900 shadow-2xl z-50 overflow-y-auto transform transition-transform"
        style={{ animation: 'slideInRight 0.3s ease-out' }}
      >
        {/* HEADER */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b border-slate-200 dark:border-slate-700 p-4 z-10">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                {corporation.name}
              </h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-2xl">
                  {COUNTRY_FLAGS[corporation.headquartersCountry.toLowerCase()] || '🏢'}
                </span>
                <span className="text-slate-600 dark:text-slate-300 uppercase font-medium">
                  {corporation.headquartersCountry}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Close panel"
            >
              <X size={20} className="text-slate-600 dark:text-slate-300" />
            </button>
          </div>

          {/* Policy Stance Badge */}
          <div className="mt-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase ${stanceColor}`}>
              {corporation.policyStance}
            </span>
          </div>
        </div>

        {/* METRICS SECTION */}
        <div className="p-4 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
              <DollarSign size={16} />
              Financial Metrics
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">AI Revenue</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatBillions(corporation.aiRevenue)}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Market Cap</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatBillions(corporation.marketCap)}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">AI Adoption</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatPercent(corporation.aiAdoptionLevel)}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Reputation</div>
                <div className={`text-lg font-bold ${reputationColor}`}>
                  {corporation.reputationScore.toFixed(0)}/100
                </div>
              </div>
            </div>
          </div>

          {/* Customer Base & Demand */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
              <Users size={16} />
              Customer Health
            </h3>

            <div className="space-y-2">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Customer Base Wellbeing
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {corporation.customerBaseWellbeing?.toFixed(1) || 'N/A'}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  Projected Demand Collapse
                  {(corporation.projectedDemandCollapse || 0) > 0.15 && (
                    <AlertTriangle size={12} className="text-red-500" />
                  )}
                </div>
                <div className={`text-lg font-bold ${demandCollapseColor}`}>
                  {formatPercent(corporation.projectedDemandCollapse || 0)}
                </div>
                {(corporation.projectedDemandCollapse || 0) > 0.15 && (
                  <div className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <AlertTriangle size={10} />
                    Warning: Customer purchasing power declining
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* POLICY CONTROLS */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 rounded-lg p-4 space-y-4 border border-blue-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
              <Building2 size={16} />
              Policy Controls
            </h3>

            {/* Contribution Rate Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Contribution Rate
                </label>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {formatPercent(corporation.contributionRate)}
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="1"
                value={corporation.contributionRate * 100}
                onChange={handleContributionRateChange}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>5%</span>
                <span>50%</span>
              </div>
            </div>

            {/* Distribution Strategy Dropdown */}
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-2">
                Distribution Strategy
              </label>
              <select
                value={corporation.distributionStrategy}
                onChange={handleStrategyChange}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
              >
                <option value="global">Global (Equal Distribution)</option>
                <option value="customer-weighted">Customer-Weighted</option>
                <option value="hq-local">HQ-Local Only</option>
              </select>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {corporation.distributionStrategy === 'global' &&
                  'Funds distributed equally per person worldwide'}
                {corporation.distributionStrategy === 'customer-weighted' &&
                  'Funds distributed proportionally to customer countries'}
                {corporation.distributionStrategy === 'hq-local' &&
                  'Funds go only to headquarters country'}
              </div>
            </div>

            {/* Effect Preview */}
            <div className="bg-white dark:bg-slate-800 rounded-md p-3 text-xs">
              <div className="font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Current Impact:
              </div>
              <div className="space-y-1 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Monthly Contribution:</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {formatBillions(corporation.aiRevenue * corporation.contributionRate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Strategy:</span>
                  <span className="font-medium text-slate-900 dark:text-white capitalize">
                    {corporation.distributionStrategy.replace('-', ' ')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* OPERATING COUNTRIES */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Globe2 size={16} />
              Operating Countries ({corporation.operatingCountries.length})
            </h3>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {corporation.operatingCountries.map((countryCode) => (
                <div
                  key={countryCode}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-sm"
                >
                  <span className="text-lg">
                    {COUNTRY_FLAGS[countryCode.toLowerCase()] || '🌍'}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 uppercase font-medium">
                    {countryCode}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        /* Custom slider styling */
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
        }

        .dark .slider::-webkit-slider-thumb {
          background: #60a5fa;
        }

        .dark .slider::-moz-range-thumb {
          background: #60a5fa;
        }
      `}</style>
    </>
  );
};

export default CorporationDetailPanel;

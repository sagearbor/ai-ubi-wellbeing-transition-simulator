
import React, { useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Globe2, Building2, DollarSign, AlertCircle, ShieldCheck, Users } from 'lucide-react';
import { CountryStats, Corporation } from '../types';

interface CountryDetailPanelProps {
  country: CountryStats | null;
  corporations: Corporation[];
  onClose: () => void;
  onUpdateCountry: (id: string, updates: Partial<CountryStats>) => void;
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

const CountryDetailPanel: React.FC<CountryDetailPanelProps> = ({
  country,
  corporations,
  onClose,
  onUpdateCountry
}) => {
  // If no country selected, don't render
  if (!country) return null;

  // Get archetype color
  const archetypeColor = useMemo(() => {
    switch (country.archetype) {
      case 'rich-democracy':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'middle-stable':
        return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      case 'developing-fragile':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      case 'authoritarian':
        return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30';
      case 'failed-state':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30';
    }
  }, [country.archetype]);

  // Get wellbeing color
  const wellbeingColor = useMemo(() => {
    if (country.wellbeing >= 70) return 'text-green-600 dark:text-green-400';
    if (country.wellbeing >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  }, [country.wellbeing]);

  // Get wellbeing trend indicator
  const wellbeingTrend = useMemo(() => {
    if (!country.wellbeingTrend || country.wellbeingTrend.length < 2) {
      return { direction: 'stable' as const, delta: 0 };
    }
    const recent = country.wellbeingTrend.slice(-2);
    const delta = recent[1] - recent[0];
    const direction = delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'stable';
    return { direction, delta };
  }, [country.wellbeingTrend]);

  // Get corps headquartered here
  const headquarteredCorps = useMemo(() => {
    return corporations.filter(corp => corp.headquartersCountry.toLowerCase() === country.id.toLowerCase());
  }, [corporations, country.id]);

  // Get corps with customers here
  const customerCorps = useMemo(() => {
    return corporations.filter(corp =>
      corp.operatingCountries.some(c => c.toLowerCase() === country.id.toLowerCase())
    );
  }, [corporations, country.id]);

  // Handle direct wallet toggle
  const handleDirectWalletToggle = () => {
    if (!country.nationalPolicy) return;
    onUpdateCountry(country.id, {
      nationalPolicy: {
        ...country.nationalPolicy,
        allowsDirectWallet: !country.nationalPolicy.allowsDirectWallet
      }
    });
  };

  // Handle local tax rate change
  const handleLocalTaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!country.nationalPolicy) return;
    const newRate = parseFloat(e.target.value) / 100; // Convert from percentage
    onUpdateCountry(country.id, {
      nationalPolicy: {
        ...country.nationalPolicy,
        localTaxOnUbi: newRate
      }
    });
  };

  // Format large numbers
  const formatNumber = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  // Format percentage
  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
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
              <div className="flex items-center gap-2 mb-1">
                <span className="text-3xl">
                  {COUNTRY_FLAGS[country.id.toLowerCase()] || '🌍'}
                </span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {country.name}
                </h2>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-600 dark:text-slate-300 uppercase font-medium">
                  {country.id}
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

          {/* Archetype Badge */}
          <div className="mt-3 flex items-center gap-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase ${archetypeColor}`}>
              {country.archetype.replace('-', ' ')}
            </span>
            <div className="flex items-center gap-1">
              <span className={`text-2xl font-bold ${wellbeingColor}`}>
                {country.wellbeing.toFixed(0)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                wellbeing
              </span>
              {wellbeingTrend.direction !== 'stable' && (
                wellbeingTrend.direction === 'up' ?
                  <TrendingUp size={16} className="text-green-500" /> :
                  <TrendingDown size={16} className="text-red-500" />
              )}
            </div>
          </div>
        </div>

        {/* UBI RECEIPT BREAKDOWN */}
        <div className="p-4 space-y-4">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-slate-800 dark:to-slate-900 rounded-lg p-4 space-y-3 border border-green-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
              <DollarSign size={16} />
              UBI Receipt Breakdown
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600 dark:text-slate-400">From global ledger:</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatNumber(country.ubiReceivedGlobal)}/person/mo
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600 dark:text-slate-400">From customer-weighted corps:</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatNumber(country.ubiReceivedCustomerWeighted)}/person/mo
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600 dark:text-slate-400">From local HQ corps:</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatNumber(country.ubiReceivedLocal)}/person/mo
                </span>
              </div>
              <div className="h-px bg-slate-300 dark:bg-slate-600 my-2" />
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total:</span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatNumber(country.totalUbiReceived)}/person/mo
                </span>
              </div>
            </div>
          </div>

          {/* ECONOMIC INDICATORS */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
              <Globe2 size={16} />
              Economic Indicators
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">GDP per capita</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatNumber(country.gdpPerCapita)}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Population</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {(country.population / 1e6).toFixed(1)}M
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Gini coefficient</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {country.gini.toFixed(2)}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">AI Adoption</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatPercent(country.aiAdoption)}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Governance</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatPercent(country.governance)}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  Displacement gap
                  {(country.displacementGap || 0) > 0 && (
                    <AlertCircle size={12} className="text-orange-500" />
                  )}
                </div>
                <div className={`text-lg font-bold ${(country.displacementGap || 0) > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                  {country.displacementGap?.toFixed(0) || '0'}
                </div>
              </div>
            </div>
          </div>

          {/* CORPORATIONS */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
              <Building2 size={16} />
              Corporations
            </h3>

            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Headquartered here ({headquarteredCorps.length}):
              </div>
              {headquarteredCorps.length > 0 ? (
                <div className="space-y-1">
                  {headquarteredCorps.map(corp => (
                    <div
                      key={corp.id}
                      className="flex items-center justify-between px-2 py-1 bg-white dark:bg-slate-900 rounded text-xs"
                    >
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {corp.name}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {formatNumber(corp.aiRevenue)}/mo
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 dark:text-slate-500 italic">
                  No corporations headquartered here
                </div>
              )}
            </div>

            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Customer base for ({customerCorps.length}):
              </div>
              {customerCorps.length > 0 ? (
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {customerCorps.map(c => c.name).join(', ')}
                </div>
              ) : (
                <div className="text-xs text-slate-400 dark:text-slate-500 italic">
                  No corporations operate here
                </div>
              )}
            </div>
          </div>

          {/* LIMITED POLICY CONTROLS */}
          {country.nationalPolicy && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 rounded-lg p-4 space-y-4 border border-blue-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                <ShieldCheck size={16} />
                Limited Policy (What Nations Can Control)
              </h3>

              {/* Direct Wallet Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    Allow Direct Wallet
                  </label>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {country.nationalPolicy.allowsDirectWallet ? 'Enabled (blockchain UBI)' : 'Blocked (authoritarian control)'}
                  </div>
                </div>
                <button
                  onClick={handleDirectWalletToggle}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    country.nationalPolicy.allowsDirectWallet
                      ? 'bg-green-600 dark:bg-green-500'
                      : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      country.nationalPolicy.allowsDirectWallet ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Local UBI Tax Rate Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Local UBI Tax Rate
                  </label>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {formatPercent(country.nationalPolicy.localTaxOnUbi)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={country.nationalPolicy.localTaxOnUbi * 100}
                  onChange={handleLocalTaxChange}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span>0%</span>
                  <span>30%</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Tax on UBI income received by citizens
                </div>
              </div>
            </div>
          )}
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

export default CountryDetailPanel;

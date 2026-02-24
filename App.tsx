import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell, Label } from 'recharts';
import { Globe, TrendingUp, Users, Sparkles, Share2, ChevronDown, BrainCircuit, Filter, FlaskConical, Hash, Link as LinkIcon, Database, Zap, MousePointer2, PlayCircle, RefreshCcw, Menu, X, HelpCircle, BookOpen, Lightbulb, ArrowRight, ArrowLeft, Info, FileText, Check, Sun, Moon, Cloud, Copy, AlertTriangle, Settings, Upload, Download, Loader2 } from 'lucide-react';
import WorldMap from './components/WorldMap';
import SimulationControls from './components/SimulationControls';
import MotionChart from './components/MotionChart';
import Guide from './components/Guide';
import { SimulationState, ModelParameters, HistoryPoint, CountryStats } from './types';
import { PRESET_MODELS, INITIAL_COUNTRIES } from './constants';
import { getRedTeamAnalysis, getSimulationSummary } from './services/geminiService';

// Helper for dynamic fund formatting
const formatFundValue = (val: number) => {
    if (val === 0) return "$0.0B";
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    return `$${val.toFixed(0)}`;
};

// Missing InfoTooltip component
const InfoTooltip = ({ text }: { text: string }) => (
  <div className="group relative inline-flex items-center ml-1">
    <Info size={12} className="text-slate-400 cursor-help" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[200] font-sans font-normal normal-case">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800" />
    </div>
  </div>
);

const App: React.FC = () => {
  const [model, setModel] = useState<ModelParameters>(PRESET_MODELS[0]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [activeTab, setActiveTab] = useState<'map' | 'charts' | 'analysis' | 'guide'>('map');
  const [viewMode, setViewMode] = useState<'adoption' | 'wellbeing'>('wellbeing');
  
  // Scenario State
  const [scenarioCountries, setScenarioCountries] = useState<Partial<CountryStats>[]>(INITIAL_COUNTRIES);

  // Initialize default selected countries
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['Global', 'USA', 'CHN', 'NGA']);

  const [analysis, setAnalysis] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('sim_theme_v1');
        return (saved as 'dark' | 'light') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('sim_theme_v1', theme);
  }, [theme]);

  const getInitialState = useCallback(() => {
    const initialCountryData: Record<string, CountryStats> = {};
    scenarioCountries.forEach(c => {
      initialCountryData[c.id!] = {
        id: c.id!,
        name: c.name!,
        population: c.population || 1,
        gdpPerCapita: c.gdpPerCapita || 10000,
        aiAdoption: c.aiAdoption || 0.01,
        wellbeing: c.wellbeing !== undefined ? c.wellbeing : 50,
        companiesJoined: c.companiesJoined || 0,
        socialResilience: c.socialResilience || 0.5,
        gini: c.gini || 0.4,
        governance: c.governance || 0.5,
        corruption: c.corruption || 0.5,
        localFundAccumulated: 0
      };
    });
    
    // Calculate initial average based on real data
    const wbSum = Object.values(initialCountryData).reduce((sum, c) => sum + c.wellbeing, 0);
    const avgWb = wbSum / Object.keys(initialCountryData).length;

    return {
      month: 0,
      globalFund: 0,
      averageWellbeing: avgWb,
      shadowAverageWellbeing: avgWb,
      totalAiCompanies: 0,
      countryData: initialCountryData
    };
  }, [scenarioCountries]);

  const [state, setState] = useState<SimulationState>(getInitialState());

  // Handle URL Sharing
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#share=')) {
      try {
        const base64 = hash.split('#share=')[1];
        const decoded = JSON.parse(atob(base64));
        if (decoded.model) {
            setModel(decoded.model);
        }
      } catch (e) {
        console.error("Failed to decode shared state", e);
      }
    }
  }, []);

  // --- IMPORT / EXPORT LOGIC ---
  const handleExportScenario = () => {
    const data = {
        model: model,
        countries: (Object.values(state.countryData) as CountryStats[]).map(c => ({
            ...c,
            aiAdoption: 0.01, // Reset progress for clean scenario
            wellbeing: c.wellbeing, 
            companiesJoined: 0
        }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation-scenario-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportScenario = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = JSON.parse(event.target?.result as string);
            if (json.model && json.countries) {
                setModel(json.model);
                setScenarioCountries(json.countries);
                alert("Scenario imported successfully. Press the Reset button to load the new world state.");
                setIsSidebarOpen(false);
            }
        } catch (err) {
            alert("Invalid scenario file.");
        }
    };
    reader.readAsText(file);
  };

  const handleReset = useCallback(() => {
    setState(getInitialState());
    setHistory([]);
    setAnalysis(null);
    setSummary(null);
    setIsPlaying(false);
  }, [getInitialState]);

  // --- THE PHYSICS ENGINE 2.2 ---
  const stepSimulation = useCallback(() => {
    setState((prev: SimulationState) => {
      const nextMonth = prev.month + 1;
      const newCountryData = { ...prev.countryData };
      let totalWellbeing = 0;
      let totalShadowWellbeing = 0;
      let newGlobalFundContribution = 0;
      let newCompaniesCount = 0;
      
      const currentCountries = Object.values(prev.countryData) as CountryStats[];
      const worldPopulation = currentCountries.reduce((a, b) => a + b.population, 0);

      // Distribute from previous pot
      const distributedAmount = prev.globalFund * 0.1; // 10% flow
      const globalUBIPerCapita = distributedAmount / worldPopulation;
      
      Object.keys(newCountryData).forEach(id => {
        const country = { ...newCountryData[id] };
        
        // --- 1. Political Dynamics ---
        const targetCorruption = Math.max(0.05, 0.9 - (country.wellbeing / 110));
        country.corruption = country.corruption + (targetCorruption - country.corruption) * 0.01; 

        // --- 2. Adoption Physics ---
        const governanceDrag = country.governance * 0.1;
        const adoptionSpeed = model.aiGrowthRate * (1.1 - governanceDrag);
        
        const mid = 0.55;
        const k = 8;
        const sigmoidIncentive = 1 / (1 + Math.exp(k * (country.aiAdoption - mid)));
        const effectiveIncentive = model.adoptionIncentive * sigmoidIncentive;
        const regionalModifier = 1 + (country.gdpPerCapita / 150000); 
        
        const growth = adoptionSpeed * regionalModifier * (1 + effectiveIncentive) * (1 - country.aiAdoption);
        
        const oldAdoption = country.aiAdoption;
        country.aiAdoption = Math.min(0.999, country.aiAdoption + growth);
        if (country.aiAdoption > oldAdoption + 0.001) {
            country.companiesJoined += 1;
            newCompaniesCount += 1;
        }

        // --- 3. Economic Physics ---
        const efficiency = 1 + (Math.pow(country.aiAdoption, 2) * 12); 
        const rawSurplus = country.gdpPerCapita * country.population * (efficiency - 1);
        
        // --- 4. Taxation & Leakage (The Bypass Update) ---
        const grossTax = rawSurplus * model.corporateTaxRate;
        
        const toGlobal = grossTax * model.globalRedistributionRate; // Global share is TAKEN BEFORE corruption 
        
        const remainingLocalTax = grossTax - toGlobal;
        const localGraft = remainingLocalTax * country.corruption; // Corruption eats the local portion
        const toLocal = remainingLocalTax - localGraft;

        newGlobalFundContribution += toGlobal;
        
        // --- 5. Demand & Realization ---
        
        // Shadow State (Slower Decay Fix)
        // Adoption grows slower naturally without incentives
        const shadowAdoption = Math.min(0.95, (prev.month * 0.0015) + (country.gdpPerCapita > 30000 ? 0.001 * prev.month : 0));
        const shadowWage = country.gdpPerCapita * (1 - shadowAdoption * 0.9); 
        // Shadow subsistence
        const globalMinSubsistence = 600; // Lowered to prevent instant death in shadow model
        const localSubsistence = country.gdpPerCapita * 0.3; 
        const effectiveSubsistence = Math.max(globalMinSubsistence, localSubsistence);
        
        // Shadow Score
        const shadowR = shadowWage / (shadowWage + effectiveSubsistence);
        const shadowW = Math.max(1, 100 * shadowR);
        totalShadowWellbeing += shadowW;

        // Real State
        const realWage = country.gdpPerCapita * (1 - country.aiAdoption * 0.95);
        const localUBIPerCapita = toLocal / country.population;
        
        // Income
        // GLOBAL UBI BYPASSES CORRUPTION (Direct-to-Wallet)
        // LOCAL UBI ALREADY FILTERED BY CORRUPTION ABOVE
        const grossIncome = realWage + localUBIPerCapita + globalUBIPerCapita;
        
        // Inequality Penalty (Gini)
        const inequalityPenalty = 1 - (country.gini * 0.3);
        const effectiveDemand = grossIncome * inequalityPenalty;

        // Realization Valve
        const r = effectiveDemand / (effectiveDemand + effectiveSubsistence);
        let w = r * 100;
        
        // Absolute Poverty / Subsistence Floor (North Korea Fix)
        // If effective demand is too low, wellbeing crashes regardless of relative status
        if (effectiveDemand < 800) w = w * 0.3; // Severe deprivation
        
        // Modifiers
        const anxiety = Math.sin(country.aiAdoption * Math.PI) * (8 * (1 - country.socialResilience));
        w -= anxiety;
        
        if (country.governance > 0.7) w += 3;
        if (country.governance < 0.3) w -= 3;

        // Inertia
        country.wellbeing = (country.wellbeing * 0.9) + (Math.max(1, Math.min(100, w)) * 0.1);
        
        newCountryData[id] = country;
        totalWellbeing += country.wellbeing;
      });

      const nextGlobalFund = prev.globalFund - distributedAmount + newGlobalFundContribution;

      const newState = {
        month: nextMonth,
        globalFund: nextGlobalFund,
        averageWellbeing: totalWellbeing / Object.keys(newCountryData).length,
        shadowAverageWellbeing: totalShadowWellbeing / Object.keys(newCountryData).length,
        totalAiCompanies: prev.totalAiCompanies + newCompaniesCount,
        countryData: newCountryData
      };

      setHistory(h => [...h.filter(p => p.month < nextMonth), { month: nextMonth, state: newState }]);
      return newState;
    });
  }, [model]);

  useEffect(() => {
    let timer: any;
    if (isPlaying) timer = setInterval(stepSimulation, 1000 / speed);
    return () => clearInterval(timer);
  }, [isPlaying, speed, stepSimulation]);

  const generateShareLink = async () => {
    try {
        const payload = { model };
        const jsonStr = JSON.stringify(payload);
        const base64 = btoa(jsonStr);
        const url = `${window.location.origin}${window.location.pathname}#share=${base64}`;
        setShareUrl(url);
    } catch (err) {
        alert("Failed to generate share link.");
    }
  };

  const handleCopyLink = async () => {
    if (shareUrl) {
        await navigator.clipboard.writeText(shareUrl);
        alert("Link copied!");
    }
  };

  const handleSeek = (m: number) => {
    setIsPlaying(false);
    if (m === 0) { setState(getInitialState()); return; }
    const point = history.find(p => p.month === m);
    if (point) setState(point.state);
  };

  const handleCountryInvestment = (id: string, delta: number) => {
    setState(prev => {
      const country = prev.countryData[id];
      if (!country) return prev;
      return {
        ...prev,
        countryData: {
          ...prev.countryData,
          [id]: {
            ...country,
            aiAdoption: Math.max(0.01, Math.min(0.999, country.aiAdoption + (delta / 50)))
          }
        }
      };
    });
  };

  return (
    <div className={`flex flex-col h-[100dvh] overflow-hidden transition-colors duration-300 ${theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
      
      <input type="file" ref={fileInputRef} onChange={handleImportScenario} accept=".json" className="hidden" />

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowShareModal(false)} />
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
                <button onClick={() => setShowShareModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20}/></button>
                <div className="text-center mb-6">
                    <h3 className="text-xl font-bold">Share Configuration</h3>
                </div>
                {!shareUrl ? (
                    <button onClick={generateShareLink} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase">Generate Link</button>
                ) : (
                    <div className="space-y-4">
                         <div className="p-3 bg-slate-100 dark:bg-slate-950 rounded-lg text-xs font-mono break-all text-slate-500">{shareUrl}</div>
                         <button onClick={handleCopyLink} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase flex items-center justify-center gap-2"><Copy size={16} /> Copy</button>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Header */}
      <header className="h-14 lg:h-16 flex items-center justify-between px-4 lg:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-[100] shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden p-2"><Menu size={20} /></button>
          <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg">
            <Sparkles className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-base lg:text-lg font-bold leading-none">Transition Engine 2.2</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-mono">Economic Physics Core</p>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {['map', 'charts', 'analysis', 'guide'].map((t: any) => (
                <button 
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${activeTab === t ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    {t}
                </button>
            ))}
          </div>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-2"/>
          <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className="p-2 text-slate-500 hover:text-white"><Sun size={16}/></button>
        </nav>
      </header>

      <main className="flex-1 overflow-hidden flex relative">
        <aside className={`fixed inset-y-0 left-0 z-[150] w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-6 shadow-2xl transition-transform lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <section className="flex-1 overflow-y-auto space-y-8 scrollbar-hide">
                <div>
                    <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Scenario Control</h2>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <button onClick={handleExportScenario} className="flex items-center justify-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"><Download size={14}/> Export</button>
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"><Upload size={14}/> Import</button>
                    </div>
                </div>

                <div>
                    <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Parameters</h2>
                    <div className="space-y-6">
                        {[
                            { label: 'Surplus Tax', key: 'corporateTaxRate', unit: '%', step: 0.01, min: 0, max: 0.9, mul: 100 },
                            { label: 'Global Redistribution', key: 'globalRedistributionRate', unit: '%', step: 0.05, min: 0, max: 1.0, mul: 100, desc: "0% = Tax stays local. 100% = Tax goes to global pot." },
                            { label: 'Adoption Incentive', key: 'adoptionIncentive', unit: '', step: 0.01, min: 0, max: 1.0, mul: 1 },
                            { label: 'Growth Speed', key: 'aiGrowthRate', unit: '%', step: 0.01, min: 0.01, max: 0.4, mul: 100 },
                            { label: 'Inequality Damping (GDP Scale)', key: 'gdpScaling', unit: '', step: 0.05, min: 0, max: 1.0, mul: 1 },
                        ].map((p: any) => (
                            <div key={p.key}>
                                <div className="flex justify-between text-[10px] mb-2 font-mono text-slate-500">
                                    <span className="flex items-center gap-1">{p.label} {p.desc && <InfoTooltip text={p.desc}/>}</span>
                                    <span className="text-slate-900 dark:text-white">{(model as any)[p.key] * p.mul}{p.unit}</span>
                                </div>
                                <input type="range" min={p.min} max={p.max} step={p.step} value={(model as any)[p.key]} onChange={(e) => setModel({ ...model, [p.key]: parseFloat(e.target.value) })} className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </aside>

        <section className="flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-50 dark:bg-slate-950">
           {activeTab === 'map' && (
             <div className="h-full flex flex-col gap-2">
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-sm">
                      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Global Wellbeing</div>
                      <div className="text-xl font-bold font-mono text-emerald-500">{state.averageWellbeing.toFixed(1)}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-sm">
                      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Ghost Baseline</div>
                      <div className="text-xl font-bold font-mono text-slate-400 dashed">{state.shadowAverageWellbeing.toFixed(1)}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-sm">
                      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Avg Adoption</div>
                      <div className="text-xl font-bold font-mono text-blue-500">{(((Object.values(state.countryData) as CountryStats[]).reduce((a,b)=>a+b.aiAdoption,0)/Object.keys(state.countryData).length)*100).toFixed(0)}%</div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-sm">
                      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Global Fund</div>
                      <div className="text-xl font-bold font-mono text-amber-500">{formatFundValue(state.globalFund)}</div>
                  </div>
               </div>

               <div className="flex-1 min-h-[400px]">
                 <WorldMap countryData={state.countryData} onCountryClick={handleCountryInvestment} viewMode={viewMode} />
               </div>
               
               <div className="flex justify-center shrink-0 mt-2">
                <div className="flex p-0.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 relative shadow-sm">
                    <button onClick={() => setViewMode('adoption')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${viewMode === 'adoption' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}>Adoption</button>
                    <button onClick={() => setViewMode('wellbeing')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${viewMode === 'wellbeing' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}>Wellbeing</button>
                </div>
              </div>
             </div>
           )}

           {activeTab === 'charts' && (
               <div className="h-full flex flex-col gap-6">
                   <div className="h-[400px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                      <MotionChart 
                        history={history}
                        maxMonth={Math.max(12, ...history.map(h => h.month))}
                        selectedCountries={selectedCountries}
                        allCountries={[{ id: 'Global', name: 'Global Average' }, ...INITIAL_COUNTRIES.map(c => ({ id: c.id!, name: c.name! }))]}
                        onToggleCountry={(id) => setSelectedCountries(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
                        theme={theme}
                      />
                   </div>
                   
                   {/* Restored Summary/RedTeam buttons below chart */}
                   <div className="grid md:grid-cols-2 gap-4">
                        <button 
                            disabled={isSummarizing || history.length === 0}
                            onClick={async () => { setIsSummarizing(true); setSummary(await getSimulationSummary(model, history)); setIsSummarizing(false); setActiveTab('analysis'); }} 
                            className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 text-xs font-bold uppercase flex items-center justify-center gap-2"
                        >
                            {isSummarizing ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                            Generate Summary
                        </button>
                        <button 
                            disabled={isAnalyzing || history.length === 0}
                            onClick={async () => { setIsAnalyzing(true); setAnalysis(await getRedTeamAnalysis(model, history)); setIsAnalyzing(false); setActiveTab('analysis'); }} 
                            className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors disabled:opacity-50 text-xs font-bold uppercase flex items-center justify-center gap-2"
                        >
                            {isAnalyzing ? <Loader2 size={16} className="animate-spin"/> : <BrainCircuit size={16}/>}
                            Red Team Attack
                        </button>
                   </div>
               </div>
           )}

           {activeTab === 'analysis' && (
               <div className="max-w-4xl mx-auto py-8">
                   {/* Buttons also here for convenience */}
                   <div className="grid md:grid-cols-2 gap-4 mb-8">
                        <button 
                            disabled={isSummarizing}
                            onClick={async () => { setIsSummarizing(true); setSummary(await getSimulationSummary(model, history)); setIsSummarizing(false); }} 
                            className="p-6 bg-indigo-600 text-white rounded-2xl shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex flex-col justify-center"
                        >
                            <h3 className="font-bold mb-2 flex items-center gap-2">
                                {isSummarizing ? <Loader2 className="animate-spin"/> : <Sparkles/>} 
                                {isSummarizing ? "Analyzing..." : "Generate Summary"}
                            </h3>
                            <p className="text-xs opacity-80">Analyze trends and suggest tweaks.</p>
                        </button>
                        <button 
                            disabled={isAnalyzing}
                            onClick={async () => { setIsAnalyzing(true); setAnalysis(await getRedTeamAnalysis(model, history)); setIsAnalyzing(false); }} 
                            className="p-6 bg-rose-600 text-white rounded-2xl shadow-lg hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex flex-col justify-center"
                        >
                             <h3 className="font-bold mb-2 flex items-center gap-2">
                                {isAnalyzing ? <Loader2 className="animate-spin"/> : <BrainCircuit/>}
                                {isAnalyzing ? "Simulating Attack..." : "Red Team Attack"}
                            </h3>
                            <p className="text-xs opacity-80">Find vulnerabilities and collapse points.</p>
                        </button>
                   </div>
                   {summary && <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 mb-4 font-mono text-xs whitespace-pre-wrap">{summary}</div>}
                   {analysis && <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 mb-4 font-mono text-xs whitespace-pre-wrap">{analysis}</div>}
               </div>
           )}

           {activeTab === 'guide' && <Guide />}
        </section>
      </main>
      
      <footer className="px-4 lg:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky bottom-0 z-[100]">
        <SimulationControls isPlaying={isPlaying} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onReset={handleReset} onStep={stepSimulation} speed={speed} setSpeed={setSpeed} month={state.month} maxMonth={history.length > 0 ? Math.max(...history.map(h => h.month)) : state.month} onSeek={handleSeek} />
      </footer>
    </div>
  );
};

export default App;
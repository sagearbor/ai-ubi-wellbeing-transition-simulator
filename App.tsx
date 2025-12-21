
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell, Label } from 'recharts';
import { Globe, TrendingUp, Users, Sparkles, Share2, ChevronDown, BrainCircuit, Filter, FlaskConical, Hash, Link as LinkIcon, Database, Zap, MousePointer2, PlayCircle, RefreshCcw, Menu, X, HelpCircle, BookOpen, Lightbulb, ArrowRight, ArrowLeft, Info, FileText, Check, Sun, Moon, Cloud, Copy, AlertTriangle, Settings } from 'lucide-react';
import WorldMap from './components/WorldMap';
import SimulationControls from './components/SimulationControls';
import { SimulationState, ModelParameters, HistoryPoint, CountryStats } from './types';
import { PRESET_MODELS, INITIAL_COUNTRIES } from './constants';
import { getRedTeamAnalysis, getSimulationSummary } from './services/geminiService';

// Helper for math rendering
const MathEq: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-1 font-mono text-lg">{children}</div>
);
const Frac: React.FC<{ n: React.ReactNode, d: React.ReactNode }> = ({ n, d }) => (
  <div className="flex flex-col items-center justify-center mx-1">
    <div className="border-b border-current px-1">{n}</div>
    <div className="px-1">{d}</div>
  </div>
);

// Helper for date formatting
const formatMonthDate = (monthIndex: number) => {
    const date = new Date(2025, monthIndex, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

// Tooltip Component for Metric Cards
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative inline-block ml-1 z-50">
            <button 
                className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white transition-colors"
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => setIsOpen(false)}
                onClick={() => setIsOpen(!isOpen)}
            >
                <Info size={12} />
            </button>
            {isOpen && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] text-slate-700 dark:text-slate-200 shadow-xl leading-relaxed pointer-events-none z-50">
                    {text}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-200 dark:border-t-slate-600" />
                </div>
            )}
        </div>
    );
};

// Tour Overlay Component
const TourOverlay: React.FC<{ step: number, onNext: () => void, onBack: () => void, onSkip: () => void }> = ({ step, onNext, onBack, onSkip }) => {
    
    const steps = [
        { 
            title: "Welcome to the Simulator", 
            text: "This engine models the transition from labor-based economies to automated abundance.", 
            pos: "top-1/4 left-1/2 -translate-x-1/2",
            target: null 
        },
        { 
            title: "Playback Controls", 
            text: "Start the simulation using the Play button. You can pause or speed up time using the controls below.", 
            pos: "bottom-24 left-4 sm:left-1/4",
            target: "bottom" 
        },
        { 
            title: "Rewind History", 
            text: "Drag the timeline slider to rewind. Change parameters from a past point and press Play to branch into an alternate reality simulation.", 
            pos: "bottom-36 left-1/2 -translate-x-1/2", 
            target: "timeline" 
        },
        { 
            title: "Parameters", 
            text: "Adjust the tax rates and incentives in the sidebar to change how the economy evolves.", 
            pos: "top-1/3 left-16 md:left-80",
            target: "sidebar" 
        },
        { 
            title: "View Modes", 
            text: "Switch between Adoption (Blue) and Wellbeing (Green/Red) to see different data layers.", 
            pos: "bottom-32 left-1/2 -translate-x-1/2 translate-y-[-50px]", 
            target: "toggle" 
        },
        { 
            title: "Analysis", 
            text: "Check the Charts tab to see detailed graphs.", 
            pos: "top-20 right-20", 
            target: "tabs" 
        },
        {
            title: "Deep Analysis",
            text: "Use the buttons in the Charts tab to generate an AI Summary or perform a Red Team Audit on the Analysis page.",
            pos: "top-40 right-10",
            target: "ai-tools"
        }
    ];

    const current = steps[step];

    return (
        <div className="fixed inset-0 z-[200] pointer-events-auto text-slate-100">
            {/* Dimmed Background */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />
            
            {/* Tooltip Card */}
            <div className={`absolute ${current.pos} w-64 bg-blue-600 text-white p-5 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-300 ring-2 ring-white/20`}>
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold uppercase tracking-widest text-xs">{current.title}</h3>
                    <span className="text-[10px] opacity-70">{step + 1}/{steps.length}</span>
                </div>
                <p className="text-xs leading-relaxed opacity-90 mb-4">{current.text}</p>
                <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                        <button onClick={onSkip} className="text-[10px] font-bold uppercase opacity-70 hover:opacity-100">Skip</button>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={onBack} 
                            disabled={step === 0}
                            className="bg-blue-700/50 text-white px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-blue-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ArrowLeft size={12}/>
                        </button>
                        <button onClick={onNext} className="bg-white text-blue-600 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:scale-105 transition-transform flex items-center gap-1">
                            {step === steps.length - 1 ? 'Finish' : 'Next'} <ArrowRight size={12}/>
                        </button>
                    </div>
                </div>
                {/* Soft Pulse Effect */}
                <div className="absolute -z-10 inset-0 rounded-2xl animate-soft-pulse pointer-events-none"></div>
            </div>
        </div>
    );
};

// Helper for dynamic fund formatting
const formatFundValue = (val: number) => {
    if (val === 0) return "$0.0B";
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    return `$${val.toFixed(0)}`;
};

const App: React.FC = () => {
  const [model, setModel] = useState<ModelParameters>(PRESET_MODELS[0]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [activeTab, setActiveTab] = useState<'map' | 'charts' | 'analysis' | 'overview' | 'equations' | 'guide'>('map');
  const [viewMode, setViewMode] = useState<'adoption' | 'wellbeing'>('adoption');
  const [eqMode, setEqMode] = useState<'simple' | 'complex'>('simple');
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['Global']);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aboutDropdownOpen, setAboutDropdownOpen] = useState(false);
  const [overviewStep, setOverviewStep] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showStartHint, setShowStartHint] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  
  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('theme') as 'dark' | 'light' || 'dark';
    }
    return 'dark';
  });

  // Tour State
  const [tourStep, setTourStep] = useState<number | null>(null);

  // Apply Theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Auto-switch tabs during tour
  useEffect(() => {
    if (tourStep === 5 || tourStep === 6) {
        setActiveTab('charts');
    } else if (tourStep !== null && tourStep < 5) {
        setActiveTab('map');
    }
  }, [tourStep]);

  const getInitialState = useCallback(() => {
    const initialCountryData: Record<string, CountryStats> = {};
    INITIAL_COUNTRIES.forEach(c => {
      initialCountryData[c.id] = {
        ...c,
        aiAdoption: 0.01,
        wellbeing: Math.min(100, Math.max(10, c.gdpPerCapita / 1200 + 40)),
        companiesJoined: 0
      };
    });
    return {
      month: 0,
      globalFund: 0,
      averageWellbeing: 50,
      totalAiCompanies: 0,
      countryData: initialCountryData
    };
  }, []);

  const [state, setState] = useState<SimulationState>(getInitialState());

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#share=')) {
      try {
        const base64 = hash.split('#share=')[1];
        const decoded = JSON.parse(atob(base64));
        // ONLY Load Model Params
        if (decoded.model) {
            setModel(decoded.model);
            // We consciously do not load history to keep URL small and reliable
            // User starts fresh with the shared parameters
        }
      } catch (e) {
        console.error("Failed to decode shared state", e);
      }
    }
  }, [getInitialState]);

  // Dismiss start hint when playing
  useEffect(() => {
    if (isPlaying) setShowStartHint(false);
  }, [isPlaying]);

  const generateShareLink = async () => {
    try {
        // STRATEGY: Only share parameters (model). 
        // This ensures URL is tiny and robust.
        const payload = { model };
        
        const jsonStr = JSON.stringify(payload);
        const base64 = btoa(jsonStr);
        const url = `${window.location.origin}${window.location.pathname}#share=${base64}`;
        setShareUrl(url);
    } catch (err) {
        console.error("Failed to generate link", err);
        alert("Failed to generate share link.");
    }
  };

  const handleCopyLink = async () => {
    if (shareUrl) {
        await navigator.clipboard.writeText(shareUrl);
        alert("Link copied to clipboard!");
    }
  };

  const handleReset = useCallback(() => {
    setState(getInitialState());
    setHistory([]);
    setAnalysis(null);
    setSummary(null);
    setIsPlaying(false);
    setShowStartHint(true);
    window.history.pushState("", document.title, window.location.pathname + window.location.search);
  }, [getInitialState]);

  const stepSimulation = useCallback(() => {
    setState(prev => {
      const nextMonth = prev.month + 1;
      const newCountryData = { ...prev.countryData };
      let totalWellbeing = 0;
      let newGlobalFundContribution = 0;
      let newCompaniesCount = 0;
      
      const worldPopulation = INITIAL_COUNTRIES.reduce((a: number, b: any) => a + b.population, 0);
      
      // Calculate Global Dividend Pool
      const dividendPerCapitaRaw = prev.globalFund / (worldPopulation * 10) || 0;

      Object.keys(newCountryData).forEach(id => {
        const country = { ...newCountryData[id] };
        
        // 1. Corporate Adoption Logic
        const mid = 0.70;
        const k = 10;
        const sigmoidIncentive = 1 / (1 + Math.exp(k * (country.aiAdoption - mid)));
        const effectiveIncentive = model.adoptionIncentive * sigmoidIncentive;
        const regionalModifier = 1 + (country.gdpPerCapita / 100000);
        const joinProbability = model.aiGrowthRate * regionalModifier * (1 + effectiveIncentive) * (1 - country.aiAdoption);
        
        if (Math.random() < joinProbability) {
          const added = Math.floor(Math.random() * 4) + 1;
          country.companiesJoined += added;
          newCompaniesCount += added;
        }

        const growth = model.aiGrowthRate * regionalModifier * (1 + country.companiesJoined * 0.02);
        country.aiAdoption = Math.min(0.999, country.aiAdoption + growth * (1 - country.aiAdoption));

        // 2. Surplus Generation
        const baseSurplus = Math.pow(country.aiAdoption, 1.6) * country.population * (country.gdpPerCapita / 40);
        const networkEffect = 1 + (country.aiAdoption * 0.4);
        const totalSurplus = baseSurplus * networkEffect;
        const fundContribution = totalSurplus * model.corporateTaxRate;
        newGlobalFundContribution += fundContribution;

        // 3. Gradient UBI Distribution (Modified by gdpScaling)
        // gdpScaling = 0 -> Flat UBI (Gradient = 1)
        // gdpScaling = 1 -> Log Proportional
        // Wealth Gradient Factor logic:
        const logGDP = Math.log10(country.gdpPerCapita + 1000);
        const scalingOffset = (logGDP - 4); // Centered roughly around 10k GDP
        const wealthGradient = 1 + (model.gdpScaling * 0.5 * scalingOffset); 
        
        const localDividend = dividendPerCapitaRaw * Math.max(0.5, wealthGradient); // Clamp to at least half

        const utilityScale = country.gdpPerCapita / 40 + 150; 
        const ubiBoost = (localDividend / utilityScale) * 120;
        
        // 4. Wellbeing Calculation
        const displacementFriction = Math.sin(country.aiAdoption * Math.PI) * (25 * (1 - country.socialResilience));
        
        let wellbeingBase = country.wellbeing + (ubiBoost * 0.12) - (displacementFriction * 0.08);
        const subsistenceFloor = country.gdpPerCapita / 25; 
        
        // Check for unrest
        if (country.aiAdoption > 0.60 && localDividend < subsistenceFloor) {
            wellbeingBase -= 1.5; 
        } else if (localDividend > subsistenceFloor * 2.5) {
            wellbeingBase += 0.8; 
        }

        country.wellbeing = Math.max(1, Math.min(100, wellbeingBase));
        newCountryData[id] = country;
        totalWellbeing += country.wellbeing;
      });

      const newState = {
        month: nextMonth,
        globalFund: prev.globalFund + newGlobalFundContribution,
        averageWellbeing: totalWellbeing / Object.keys(newCountryData).length,
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
            companiesJoined: Math.max(0, country.companiesJoined + delta),
            aiAdoption: Math.max(0.01, Math.min(0.999, country.aiAdoption + (delta / 50)))
          }
        }
      };
    });
  };

  const triggerSummarize = async () => {
    if (summary && !isSummarizing) return;
    setIsSummarizing(true);
    const res = await getSimulationSummary(model, history);
    setSummary(res || "Summary failed.");
    setIsSummarizing(false);
  };

  const triggerRedTeam = async () => {
    if (analysis && !isAnalyzing) return;
    setIsAnalyzing(true);
    const res = await getRedTeamAnalysis(model, history);
    setAnalysis(res || "Analysis failed.");
    setIsAnalyzing(false);
  };

  // --- OVERVIEW ANIMATION LOGIC ---
  const overviewCycleData = useMemo(() => {
    const cycleLength = 3200;
    const step = overviewStep % cycleLength;
    const centerX = 400;
    const centerY = 300;

    const tStart = 100;
    const tPhase1 = 600; 
    const tPhase2 = 1100;
    const tExpand = 1600;
    const tEnd = 3000;
    const isExpanding = step >= tExpand;
    const expansionProgress = isExpanding ? Math.min(1, (step - tExpand) / (tEnd - tExpand)) : 0;
    
    // Dynamic Geometry Calculation
    const baseNodeRadius = 45; 
    const scale = 1 + (expansionProgress * 0.4); 
    const currentNodeRadius = baseNodeRadius * scale;
    const perimeterGap = 130; 
    const sideLength = (currentNodeRadius * 2) + perimeterGap;
    const currentRadius = sideLength / Math.sqrt(3);

    const rad30 = Math.PI / 6;
    const cos30 = Math.cos(rad30);
    const sin30 = Math.sin(rad30);
    
    const vA = { x: centerX, y: centerY - currentRadius };
    const vB = { x: centerX + currentRadius * cos30, y: centerY + currentRadius * sin30 };
    const vC = { x: centerX - currentRadius * cos30, y: centerY + currentRadius * sin30 };
    
    const midAB = { x: (vA.x + vB.x) / 2, y: (vA.y + vB.y) / 2 };
    const midBC = { x: (vB.x + vC.x) / 2, y: (vB.y + vC.y) / 2 };
    const midCA = { x: (vC.x + vA.x) / 2, y: (vC.y + vA.y) / 2 };

    const getProgress = (start: number, end: number) => {
        if (step < start) return 0;
        if (step >= end) return 1;
        return (step - start) / (end - start);
    };
    
    const prog1 = getProgress(tStart, tPhase1);
    const prog2 = getProgress(tPhase1, tPhase2);
    const prog3 = getProgress(tPhase2, tExpand);
    
    const isSnapped1 = step >= tPhase1;
    const isSnapped2 = step >= tPhase2;
    const isSnapped3 = step >= tExpand;
    
    const showTendril1 = step >= tStart;
    const showTendril2 = step >= tPhase1;
    const showTendril3 = step >= tPhase2;
    
    const showNodeA = true;
    const showNodeB = step >= (tStart + (tPhase1 - tStart) * 0.7); 
    const showNodeC = true;
    
    const corpWedges = [
      { name: 'Traditional', value: 90 - (expansionProgress * 60), color: '#3b82f6' }, 
      { name: 'Automated', value: 10 + (expansionProgress * 60), color: '#10b981' }   
    ];

    const ledgerWedges = [
      { name: 'Funded', value: 5 + (expansionProgress * 90), color: '#f59e0b' },      
      { name: 'Empty', value: 95 - (expansionProgress * 90), color: '#334155' }       
    ];
    
    const humanWedges = [
      { name: 'Thriving', value: 20 + expansionProgress * 70, color: '#10b981' },
      { name: 'Scarcity', value: 80 - expansionProgress * 70, color: '#ef4444' }
    ];

    return {
      step, vA, vB, vC, scale,
      midAB, midBC, midCA,
      showTendril1, showTendril2, showTendril3,
      prog1, prog2, prog3,
      isSnapped1, isSnapped2, isSnapped3,
      showNodeA, showNodeB, showNodeC,
      corpWedges, humanWedges, ledgerWedges,
      isExpanding,
      particleSpeed: 0.5 + expansionProgress * 1.5
    };
  }, [overviewStep, model.corporateTaxRate]);

  const getSnakePath = (start: {x: number, y: number}, end: {x: number, y: number}, isSnapped: boolean) => {
    if (isSnapped) {
        return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    }
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const perpX = -dy * 0.25;
    const perpY = dx * 0.25;
    const cp1x = start.x + dx * 0.25 + perpX;
    const cp1y = start.y + dy * 0.25 + perpY;
    const cp2x = start.x + dx * 0.75 - perpX;
    const cp2y = start.y + dy * 0.75 - perpY;
    return `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;
  };

  const chartData = useMemo(() => {
    return history.map(point => {
      const data: any = { 
          month: point.month, 
          date: formatMonthDate(point.month),
          fund: point.state.globalFund / 1e9 
      };
      data['Wellbeing_Global'] = point.state.averageWellbeing;
      const globalAdoption = (Object.values(point.state.countryData) as CountryStats[]).reduce((acc, curr) => acc + curr.aiAdoption, 0) / INITIAL_COUNTRIES.length * 100;
      data['Adoption_Global'] = globalAdoption;
      Object.keys(point.state.countryData).forEach(id => {
        data[`Wellbeing_${id}`] = point.state.countryData[id].wellbeing;
        data[`Adoption_${id}`] = point.state.countryData[id].aiAdoption * 100;
      });
      return data;
    });
  }, [history]);

  useEffect(() => {
    let interval: any;
    if (activeTab === 'overview') {
        interval = setInterval(() => setOverviewStep(s => s + 4), 20); 
    }
    return () => clearInterval(interval);
  }, [activeTab]);

  return (
    <div className={`flex flex-col h-[100dvh] overflow-hidden transition-colors duration-300 ${theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
      {/* Tour Overlay */}
      {tourStep !== null && (
          <TourOverlay 
            step={tourStep} 
            onNext={() => {
                if (tourStep < 6) {
                    setTourStep(tourStep + 1);
                } else {
                    setTourStep(null);
                    setActiveTab('map');
                }
            }} 
            onBack={() => setTourStep(prev => (prev !== null && prev > 0) ? prev - 1 : null)}
            onSkip={() => {
                setTourStep(null);
                setActiveTab('map');
            }}
          />
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowShareModal(false)} />
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <button onClick={() => setShowShareModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"><X size={20}/></button>
                
                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Settings size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Share Model Configuration</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Share your custom simulation parameters with others.</p>
                </div>

                {!shareUrl ? (
                    <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-xl flex gap-3 text-left">
                            <Info className="text-blue-600 dark:text-blue-400 shrink-0" size={20} />
                            <div className="space-y-1">
                                <h4 className="text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-wide">Sharing Info</h4>
                                <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">This will generate a link containing your current tax rates, incentives, and model settings. The recipient will start a fresh simulation with these parameters.</p>
                            </div>
                        </div>
                        <button 
                            onClick={generateShareLink}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-all shadow-lg shadow-blue-600/20"
                        >
                            Generate Link
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                         <div className="p-3 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 break-all text-xs font-mono text-slate-600 dark:text-slate-400">
                            {shareUrl.substring(0, 50)}...
                         </div>
                         <button 
                            onClick={handleCopyLink}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                        >
                            <Copy size={16} /> Copy to Clipboard
                        </button>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Header */}
      <header className="h-14 lg:h-16 flex items-center justify-between px-4 lg:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-[100] shrink-0 transition-colors">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg active:bg-slate-100 dark:active:bg-slate-800"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          
          <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg lg:rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Sparkles className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-base lg:text-lg font-bold leading-none text-slate-900 dark:text-white">Transition Engine</h1>
            <p className="text-[8px] lg:text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1 font-mono">Abundance Cycle v13.0</p>
          </div>
        </div>

        <nav className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg lg:rounded-xl border border-slate-200 dark:border-slate-700">
          {(['map', 'charts'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setAboutDropdownOpen(false); }}
              className={`px-3 py-1 lg:px-4 lg:py-1.5 rounded-md lg:rounded-lg text-[10px] lg:text-xs font-bold uppercase transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
            >
              {tab}
            </button>
          ))}
          <div className="relative group">
            <button 
              onMouseEnter={() => setAboutDropdownOpen(true)}
              onClick={() => setAboutDropdownOpen(!aboutDropdownOpen)}
              className={`px-3 py-1 lg:px-4 lg:py-1.5 rounded-md lg:rounded-lg text-[10px] lg:text-xs font-bold uppercase flex items-center gap-1 transition-all ${(activeTab === 'overview' || activeTab === 'equations' || activeTab === 'analysis' || activeTab === 'guide') ? 'bg-slate-800 text-white dark:bg-slate-700 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
            >
                More <ChevronDown size={12} className={aboutDropdownOpen ? 'rotate-180' : ''} />
            </button>
            {aboutDropdownOpen && (
                <div 
                  onMouseLeave={() => setAboutDropdownOpen(false)}
                  className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[110]"
                >
                    <button onClick={() => { setActiveTab('guide'); setAboutDropdownOpen(false); }} className="w-full text-left px-4 py-3 text-xs font-bold uppercase hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors border-b border-slate-100 dark:border-slate-700 flex items-center gap-2"><BookOpen size={14} /> About & Guide</button>
                    <button onClick={() => { setActiveTab('overview'); setAboutDropdownOpen(false); }} className="w-full text-left px-4 py-3 text-xs font-bold uppercase hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors border-b border-slate-100 dark:border-slate-700 flex items-center gap-2"><Globe size={14} /> Overview</button>
                    <button onClick={() => { setActiveTab('equations'); setAboutDropdownOpen(false); }} className="w-full text-left px-4 py-3 text-xs font-bold uppercase hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors border-b border-slate-100 dark:border-slate-700 flex items-center gap-2"><FlaskConical size={14} /> Model Equations</button>
                    <button onClick={() => { setActiveTab('analysis'); setAboutDropdownOpen(false); }} className="w-full text-left px-4 py-3 text-xs font-bold uppercase hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2"><BrainCircuit size={14} /> Analysis Hub</button>
                </div>
            )}
          </div>
          
          <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1"></div>
          
          <button 
             onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
             className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </nav>
      </header>

      <main className="flex-1 overflow-hidden flex relative">
        {/* Mobile Backdrop */}
        {isSidebarOpen && (
            <div 
                className="fixed inset-0 bg-black/60 z-[140] lg:hidden backdrop-blur-sm transition-opacity"
                onClick={() => setIsSidebarOpen(false)}
            />
        )}

        {/* Sidebar Navigation */}
        <aside className={`
            fixed inset-y-0 left-0 z-[150] w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-6 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
            lg:relative lg:translate-x-0 lg:bg-white dark:lg:bg-slate-900 lg:shadow-none lg:z-0
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex justify-between items-center lg:hidden mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Configuration</span>
            <button onClick={() => setIsSidebarOpen(false)} className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"><X size={20}/></button>
          </div>

          <section className="flex-1 overflow-y-auto scrollbar-hide space-y-8">
            <div>
                <h2 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">Baseline Models</h2>
                <div className="grid grid-cols-1 gap-2">
                {PRESET_MODELS.map(m => (
                    <button
                    key={m.id}
                    onClick={() => { setModel({ ...m, isCustom: false }); if(window.innerWidth < 1024) setIsSidebarOpen(false); }}
                    className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all ${model.id === m.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'}`}
                    >
                    {m.name}
                    </button>
                ))}
                </div>
            </div>

            <div>
                <h2 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">Parameters</h2>
                <div className="space-y-6">
                {[
                    { label: 'Surplus Tax', key: 'corporateTaxRate', unit: '%', step: 0.01, min: 0, max: 0.9, multiplier: 100 },
                    { label: 'Adoption Incentive', key: 'adoptionIncentive', unit: '', step: 0.01, min: 0, max: 1.0, multiplier: 1 },
                    { label: 'Growth Speed', key: 'aiGrowthRate', unit: '%', step: 0.01, min: 0.01, max: 0.4, multiplier: 100 },
                    { label: 'GDP Scaling', key: 'gdpScaling', unit: '', step: 0.05, min: 0, max: 1.0, multiplier: 1 },
                ].map(p => (
                    <div key={p.key}>
                    <div className="flex justify-between text-[10px] mb-2 font-mono text-slate-500 dark:text-slate-400"><span>{p.label}</span><span className="text-slate-900 dark:text-white">{(model as any)[p.key] * p.multiplier}{p.unit}</span></div>
                    <input type="range" min={p.min} max={p.max} step={p.step} value={(model as any)[p.key]} onChange={(e) => setModel({ ...model, [p.key]: parseFloat(e.target.value) })} className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                    </div>
                ))}
                </div>
            </div>
          </section>
            
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <button 
                onClick={() => { setShareUrl(null); setShowShareModal(true); }}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
            >
                <Share2 size={16} /> Share Model
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-50 dark:bg-slate-950 relative h-full scrollbar-hide">
          {activeTab === 'map' && (
            <div className="h-full flex flex-col gap-2">
              {/* Compact Stats Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0">
                {[
                  { label: 'Wellbeing', val: state.averageWellbeing.toFixed(1), color: 'text-emerald-600 dark:text-emerald-400', desc: "Avg Human Wellbeing (0-100). Includes UBI utility + displacement friction." },
                  { label: 'Dividend', val: `$${(state.globalFund / (INITIAL_COUNTRIES.reduce((a,b)=>a+b.population,0)*10)).toFixed(0)}`, color: 'text-amber-600 dark:text-amber-400', desc: "Monthly payment per citizen, weighted by GDP scaling parameter." },
                  { label: 'Adoption', val: `${((Object.values(state.countryData) as CountryStats[]).reduce((acc, curr) => acc + curr.aiAdoption, 0) / INITIAL_COUNTRIES.length * 100).toFixed(0)}%`, color: 'text-blue-600 dark:text-blue-400', desc: "Percentage of corporate value produced by Autonomous Systems." },
                  { label: 'Fund', val: formatFundValue(state.globalFund), color: 'text-slate-900 dark:text-white', desc: "Total accumulated Surplus Pool available for distribution." }
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-lg flex justify-between items-center shadow-sm">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest flex items-center">
                            {stat.label}
                            <InfoTooltip text={stat.desc} />
                        </div>
                        <div className={`text-sm lg:text-lg font-bold font-mono ${stat.color}`}>{stat.val}</div>
                    </div>
                ))}
              </div>

              <div className="flex-1 min-h-[300px] relative">
                <WorldMap countryData={state.countryData} onCountryClick={handleCountryInvestment} viewMode={viewMode} />
                
                {/* How To Start Hint Overlay */}
                {showStartHint && !isPlaying && (
                    <div className="absolute top-4 right-4 z-20 w-48 bg-blue-600/95 text-white p-4 rounded-xl shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-700">
                        <div className="flex items-start gap-3">
                            <Lightbulb className="shrink-0 mt-0.5" size={18} />
                            <div>
                                <h3 className="font-bold text-xs uppercase tracking-widest mb-1">Start Here</h3>
                                <p className="text-[10px] leading-relaxed opacity-90 mb-3">Press <span className="font-bold text-white bg-white/20 px-1 rounded">PLAY</span> below to begin the simulation. Observe how the gradient UBI stabilizes global wellbeing.</p>
                                <button 
                                    onClick={() => setTourStep(0)}
                                    className="w-full py-1.5 bg-white text-blue-600 rounded-lg text-[10px] font-bold uppercase hover:bg-blue-50 transition-colors"
                                >
                                    Take a Tour
                                </button>
                            </div>
                        </div>
                    </div>
                )}
              </div>

              <div className="flex justify-center shrink-0 mt-2">
                <div className="flex p-0.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 relative shadow-sm">
                    <button onClick={() => setViewMode('adoption')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${viewMode === 'adoption' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}>Adoption</button>
                    <button onClick={() => setViewMode('wellbeing')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${viewMode === 'wellbeing' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}>Wellbeing</button>
                    {tourStep === 4 && (
                        <div className="absolute -inset-2 border-2 border-blue-500 rounded-xl animate-pulse pointer-events-none" />
                    )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'charts' && (
            <div className="flex flex-col gap-6 lg:gap-8 h-full overflow-y-auto scrollbar-hide pb-32 relative">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex-1 w-full sm:w-auto shadow-sm">
                   <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 w-full mb-2 flex items-center gap-1 uppercase tracking-widest"><Filter size={10}/> Observation Target List</div>
                   {['Global', ...INITIAL_COUNTRIES.map(c => c.id)].map(id => (
                     <button 
                       key={id}
                       onClick={() => setSelectedCountries(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                       className={`px-3 py-1 rounded text-[10px] font-bold uppercase border transition-all ${selectedCountries.includes(id) ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                     >{id}</button>
                   ))}
                </div>

                <div className="flex gap-2 w-full sm:w-auto" id="ai-tools">
                    <button 
                    onClick={() => { setActiveTab('analysis'); triggerSummarize(); }}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-xl transition-all active:scale-95"
                    >
                        <Sparkles size={16} />
                        <span>Summarize</span>
                    </button>

                    <button 
                        onClick={() => { setActiveTab('analysis'); triggerRedTeam(); }}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-xl transition-all active:scale-95"
                    >
                        <BrainCircuit size={16} />
                        <span>Red Team</span>
                    </button>
                </div>
              </div>
              
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 lg:p-8 rounded-2xl lg:rounded-[2rem] h-[350px] lg:h-[500px] shrink-0 shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e2e8f0' : '#1e293b'} vertical={false} />
                    <XAxis dataKey="date" stroke={theme === 'light' ? '#64748b' : '#94a3b8'} fontSize={10} minTickGap={30} />
                    <YAxis stroke={theme === 'light' ? '#64748b' : '#94a3b8'} fontSize={10} domain={[0, 100]}>
                        <Label value="Score 0-100" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: theme === 'light' ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                    </YAxis>
                    <Tooltip contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#0f172a', border: '1px solid #334155', borderRadius: '16px', color: theme === 'light' ? '#000' : '#fff' }} />
                    <Legend />
                    {selectedCountries.map((id, idx) => {
                        const hue = (idx * 137) % 360;
                        return (
                          <React.Fragment key={id}>
                            <Area type="monotone" dataKey={`Wellbeing_${id}`} stroke={`hsl(${hue}, 70%, 60%)`} fill={`hsl(${hue}, 70%, 60%)`} fillOpacity={0.05} strokeWidth={3} name={`${id} Wellbeing`} />
                            <Area type="monotone" dataKey={`Adoption_${id}`} stroke={`hsl(${hue}, 40%, 40%)`} fill="none" strokeWidth={1} strokeDasharray="6 3" name={`${id} AI %`} />
                          </React.Fragment>
                        );
                    })}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 lg:p-8 rounded-2xl lg:rounded-[2rem] h-[250px] lg:h-[300px] shrink-0 shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e2e8f0' : '#1e293b'} vertical={false} />
                    <XAxis dataKey="date" stroke={theme === 'light' ? '#64748b' : '#94a3b8'} fontSize={10} minTickGap={30} />
                    <YAxis stroke={theme === 'light' ? '#64748b' : '#94a3b8'} fontSize={10}>
                         <Label value="Funds $B" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: theme === 'light' ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                    </YAxis>
                    <Tooltip contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#0f172a', border: '1px solid #334155', borderRadius: '16px', color: theme === 'light' ? '#000' : '#fff' }} />
                    <Line type="monotone" dataKey="fund" stroke="#f59e0b" strokeWidth={4} dot={false} name="Distributed Surplus Pool ($B)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        
          {activeTab === 'analysis' && (
             <div className="max-w-6xl mx-auto py-6 lg:py-12 flex flex-col lg:flex-row gap-6 lg:gap-8 h-full">
                
                {/* Control Panel */}
                <div className="lg:w-1/3 flex flex-col gap-6 shrink-0">
                     <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-lg">
                        <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 mb-4">
                            <Sparkles size={24} />
                            <h3 className="text-lg font-bold">Simulation Summary</h3>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-xs mb-6 leading-relaxed">Generate a concise report of your current run, highlighting key trends in adoption and wellbeing outcomes.</p>
                        <button 
                            onClick={triggerSummarize}
                            disabled={isSummarizing}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            {isSummarizing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <PlayCircle size={16} />}
                            Generate Summary
                        </button>
                     </div>

                     <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-lg">
                        <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-4">
                            <BrainCircuit size={24} />
                            <h3 className="text-lg font-bold">Red Team Audit</h3>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-xs mb-6 leading-relaxed">Deploy an adversarial AI agent to identify structural weaknesses, potential collapse points, and equation flaws.</p>
                        <button 
                            onClick={triggerRedTeam}
                            disabled={isAnalyzing}
                            className="w-full py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            {isAnalyzing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <PlayCircle size={16} />}
                            Run Vulnerability Scan
                        </button>
                     </div>
                </div>

                {/* Results Panel */}
                <div className="lg:w-2/3 flex flex-col gap-6 overflow-y-auto">
                    {/* Summary Result */}
                    {summary && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 p-6 rounded-3xl animate-in slide-in-from-right-4">
                            <h4 className="text-indigo-700 dark:text-indigo-400 font-bold uppercase text-xs tracking-widest mb-4 flex items-center gap-2"><FileText size={14}/> Run Report</h4>
                            <div className="prose prose-sm max-w-none text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-mono text-xs">
                                {summary}
                            </div>
                        </div>
                    )}

                    {/* Red Team Result */}
                    {analysis && (
                        <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 p-6 rounded-3xl animate-in slide-in-from-right-4">
                             <h4 className="text-rose-700 dark:text-rose-400 font-bold uppercase text-xs tracking-widest mb-4 flex items-center gap-2"><BrainCircuit size={14}/> Audit Logs</h4>
                             <div className="prose prose-sm max-w-none text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-mono text-xs">
                                {analysis}
                            </div>
                        </div>
                    )}

                    {!summary && !analysis && (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 min-h-[300px] border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl">
                            <BrainCircuit size={48} className="mb-4 opacity-50" />
                            <p className="text-sm font-medium">No analysis data generated.</p>
                            <p className="text-xs">Run a simulation then select an audit tool.</p>
                        </div>
                    )}
                </div>
             </div>
          )}

          {activeTab === 'guide' && (
            <div className="max-w-4xl mx-auto py-8 lg:py-12 space-y-12 animate-in slide-in-from-bottom-4 duration-500">
                <div className="text-center space-y-4">
                    <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">How to Use the Simulator</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-lg">A field guide to modeling the economic transition.</p>
                </div>

                <div className="grid gap-8">
                     <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2rem] shadow-sm">
                        <h3 className="text-slate-900 dark:text-white text-sm font-bold uppercase tracking-widest mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">Getting Started</h3>
                        <ol className="list-decimal pl-5 space-y-6 text-slate-600 dark:text-slate-300 text-sm">
                            <li className="pl-2">
                                <span className="text-slate-900 dark:text-white font-bold block mb-1">Select a Baseline Model</span>
                                Open the sidebar (or look left) and choose a starting preset like "Organic Incentive" or "Social Stability". This sets the initial parameters.
                            </li>
                            <li className="pl-2">
                                <span className="text-slate-900 dark:text-white font-bold block mb-1">Start the Simulation</span>
                                Press the <PlayCircle className="inline mx-1 text-sky-500" size={16}/> Play button at the bottom of the screen. Watch the "Month" counter advance.
                            </li>
                            <li className="pl-2">
                                <span className="text-slate-900 dark:text-white font-bold block mb-1">Observe Interactions <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 uppercase ml-2 tracking-wide">Optional</span></span>
                                Switch between <strong>Adoption</strong> and <strong>Wellbeing</strong> view modes on the map to see different data overlays.
                                <span className="block mt-2 text-slate-500 italic text-xs">*Note: All monetary figures are in USD equivalent.</span>
                            </li>
                        </ol>
                     </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2rem] shadow-sm">
                            <h3 className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2"><FlaskConical size={16}/> Parameters (Sidebar)</h3>
                            <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                                <li>
                                    <strong className="text-slate-900 dark:text-white block mb-1">Surplus Tax</strong>
                                    Percentage of AI-generated profit collected for the Global Dividend Fund. Higher taxes fund better UBI but may slow corporate adoption.
                                </li>
                                <li>
                                    <strong className="text-slate-900 dark:text-white block mb-1">Adoption Incentive</strong>
                                    Subsidy provided to corporations to automate. High incentives speed up the transition but drain resources early on.
                                </li>
                                <li>
                                    <strong className="text-slate-900 dark:text-white block mb-1">Growth Speed</strong>
                                    The viral coefficient of AI technology. How quickly one automated firm leads to others following suit.
                                </li>
                            </ul>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2rem] shadow-sm">
                            <h3 className="text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2"><MousePointer2 size={16}/> Advanced Controls</h3>
                            <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                                <li>
                                    <strong className="text-slate-900 dark:text-white block mb-1">Invest / Divest <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 uppercase ml-2 tracking-wide">Interactive</span></strong>
                                    <span className="text-sky-600 dark:text-sky-400">Left Click</span> a country on the map to manually boost AI adoption. 
                                    <span className="text-rose-600 dark:text-rose-400"> Right Click</span> to sanction/lower adoption.
                                </li>
                                <li>
                                    <strong className="text-slate-900 dark:text-white block mb-1">Rewind Time</strong>
                                    Drag the timeline slider at the bottom to jump back to any previous month.
                                </li>
                                <li>
                                    <strong className="text-slate-900 dark:text-white block mb-1">Summarize & Improve</strong>
                                    In the Charts tab, use this button to have an AI analyze your current run and suggest parameter tweaks.
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className={`max-w-6xl mx-auto py-6 lg:py-12 space-y-8 animate-in fade-in duration-1000 h-full flex flex-col`}>
                <div className="shrink-0 text-center mb-4">
                    <h2 className="text-2xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">The Abundance Loop</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm lg:text-lg font-medium">Mathematical visualization of synchronized productivity capture.</p>
                </div>
                
                {/* Desktop: 2 Columns. Mobile: Stacked */}
                <div className="flex-1 grid lg:grid-cols-5 gap-8 lg:gap-12 min-h-0">
                    
                    {/* Left: Animation (Takes 3/5 width on desktop) */}
                    <div className="lg:col-span-3 flex items-center justify-center min-h-0">
                        <div className="relative w-full aspect-[4/3] bg-white dark:bg-slate-900 rounded-3xl lg:rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                            <div className="absolute top-4 right-4 z-20">
                              <button 
                                onClick={() => setOverviewStep(0)}
                                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all shadow-xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest border border-slate-200 dark:border-slate-700 active:scale-95"
                              >
                                <RefreshCcw size={14} /> Restart
                              </button>
                            </div>

                            <svg viewBox="0 0 800 600" className="absolute inset-0 w-full h-full pointer-events-none">
                                <defs>
                                  <filter id="glow"><feGaussianBlur stdDeviation="6" result="blur"/><feComposite in="SourceGraphic" in2="blur" operator="over"/></filter>
                                </defs>
                                
                                {/* Guideline Triangle */}
                                <path 
                                  d={`M ${overviewCycleData.vA.x} ${overviewCycleData.vA.y} L ${overviewCycleData.vB.x} ${overviewCycleData.vB.y} L ${overviewCycleData.vC.x} ${overviewCycleData.vC.y} Z`} 
                                  fill="none" stroke={theme === 'light' ? '#cbd5e1' : '#334155'} strokeWidth="2" strokeDasharray="5 5" opacity={0.3} 
                                />

                                {/* Animated Tendrils */}
                                {overviewCycleData.showTendril1 && (
                                    <>
                                        <path 
                                            d={getSnakePath(overviewCycleData.vA, overviewCycleData.vB, overviewCycleData.isSnapped1)} 
                                            fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round"
                                            strokeDasharray="1000" strokeDashoffset={1000 * (1 - overviewCycleData.prog1)}
                                            opacity={0.8}
                                        />
                                        <text x={overviewCycleData.midAB.x} y={overviewCycleData.midAB.y} fill="#3b82f6" fontSize="24" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle" opacity={overviewCycleData.prog1 > 0.5 ? 1 : 0} className="transition-opacity duration-300">$</text>
                                    </>
                                )}
                                {overviewCycleData.showTendril2 && (
                                    <>
                                        <path 
                                            d={getSnakePath(overviewCycleData.vB, overviewCycleData.vC, overviewCycleData.isSnapped2)} 
                                            fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round"
                                            strokeDasharray="1000" strokeDashoffset={1000 * (1 - overviewCycleData.prog2)}
                                            opacity={0.8}
                                        />
                                        <text x={overviewCycleData.midBC.x} y={overviewCycleData.midBC.y} fill="#f59e0b" fontSize="24" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle" opacity={overviewCycleData.prog2 > 0.5 ? 1 : 0} className="transition-opacity duration-300">$</text>
                                    </>
                                )}
                                {overviewCycleData.showTendril3 && (
                                    <>
                                        <path 
                                            d={getSnakePath(overviewCycleData.vC, overviewCycleData.vA, overviewCycleData.isSnapped3)} 
                                            fill="none" stroke="#10b981" strokeWidth="5" strokeLinecap="round"
                                            strokeDasharray="1000" strokeDashoffset={1000 * (1 - overviewCycleData.prog3)}
                                            opacity={0.8}
                                        />
                                        <text x={overviewCycleData.midCA.x} y={overviewCycleData.midCA.y} fill="#10b981" fontSize="24" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle" opacity={overviewCycleData.prog3 > 0.5 ? 1 : 0} className="transition-opacity duration-300">$</text>
                                    </>
                                )}

                                {/* Particle Flow (Only during expansion) */}
                                {overviewCycleData.isExpanding && (
                                  <>
                                    <circle r="6" fill="#3b82f6" filter="url(#glow)">
                                        <animateMotion dur={`${6 / overviewCycleData.particleSpeed}s`} repeatCount="indefinite" path={`M ${overviewCycleData.vA.x} ${overviewCycleData.vA.y} L ${overviewCycleData.vB.x} ${overviewCycleData.vB.y}`} />
                                    </circle>
                                    <circle r="6" fill="#f59e0b" filter="url(#glow)">
                                        <animateMotion dur={`${6 / overviewCycleData.particleSpeed}s`} repeatCount="indefinite" path={`M ${overviewCycleData.vB.x} ${overviewCycleData.vB.y} L ${overviewCycleData.vC.x} ${overviewCycleData.vC.y}`} />
                                    </circle>
                                    <circle r="6" fill="#10b981" filter="url(#glow)">
                                        <animateMotion dur={`${3 / overviewCycleData.particleSpeed}s`} repeatCount="indefinite" path={`M ${overviewCycleData.vC.x} ${overviewCycleData.vC.y} L ${overviewCycleData.vA.x} ${overviewCycleData.vA.y}`} />
                                    </circle>
                                  </>
                                )}
                            </svg>

                            {/* Node A */}
                            {overviewCycleData.showNodeA && (
                            <div 
                              className="absolute flex flex-col items-center justify-center transition-all duration-75 pointer-events-none"
                              style={{ 
                                left: `${(overviewCycleData.vA.x / 800) * 100}%`,
                                top: `${(overviewCycleData.vA.y / 600) * 100}%`,
                                transform: `translate(-50%, -50%) scale(${overviewCycleData.scale})`
                              }}
                            >
                                <div className="mb-2 text-center">
                                    <h4 className="font-bold text-[8px] sm:text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-blue-500 dark:text-blue-400">Corporations</h4>
                                </div>
                                <div className="relative w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                      <Pie data={overviewCycleData.corpWedges} dataKey="value" stroke="none" paddingAngle={2} isAnimationActive={false}>
                                        {overviewCycleData.corpWedges.map((e, i) => <Cell key={i} fill={e.color} />)}
                                      </Pie>
                                    </PieChart>
                                  </ResponsiveContainer>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="bg-white dark:bg-slate-950 rounded-full w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 border border-blue-500/20 flex items-center justify-center shadow-inner">
                                      <TrendingUp className="text-blue-500" size={24} />
                                    </div>
                                  </div>
                                </div>
                            </div>
                            )}

                            {/* Node B */}
                            {overviewCycleData.showNodeB && (
                              <div 
                                className="absolute flex flex-col items-center justify-center transition-all duration-75 pointer-events-none animate-in fade-in zoom-in duration-300"
                                style={{ 
                                  left: `${(overviewCycleData.vB.x / 800) * 100}%`,
                                  top: `${(overviewCycleData.vB.y / 600) * 100}%`,
                                  transform: `translate(-50%, -50%) scale(${overviewCycleData.scale})`
                                }}
                              >
                                  <div className="relative w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40">
                                     <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                          <Pie data={overviewCycleData.ledgerWedges} dataKey="value" stroke="none" paddingAngle={2} isAnimationActive={false}>
                                            {overviewCycleData.ledgerWedges.map((e, i) => <Cell key={i} fill={e.color} />)}
                                          </Pie>
                                        </PieChart>
                                      </ResponsiveContainer>
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="bg-white dark:bg-slate-950 rounded-full w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 border border-amber-500/20 flex items-center justify-center shadow-inner">
                                          <Database className="text-amber-500" size={24} />
                                        </div>
                                      </div>
                                  </div>
                                  <div className="mt-2 text-center">
                                      <h4 className="font-bold text-[8px] sm:text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-amber-500 dark:text-amber-400">Ledger</h4>
                                  </div>
                              </div>
                            )}

                            {/* Node C */}
                            {overviewCycleData.showNodeC && (
                            <div 
                              className="absolute flex flex-col items-center justify-center transition-all duration-75 pointer-events-none"
                              style={{ 
                                left: `${(overviewCycleData.vC.x / 800) * 100}%`,
                                top: `${(overviewCycleData.vC.y / 600) * 100}%`,
                                transform: `translate(-50%, -50%) scale(${overviewCycleData.scale})`
                              }}
                            >
                                <div className="relative w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                      <Pie data={overviewCycleData.humanWedges} dataKey="value" stroke="none" paddingAngle={2} isAnimationActive={false}>
                                        {overviewCycleData.humanWedges.map((e, i) => <Cell key={i} fill={e.color} />)}
                                      </Pie>
                                    </PieChart>
                                  </ResponsiveContainer>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="bg-white dark:bg-slate-950 rounded-full w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 border border-emerald-500/20 flex items-center justify-center shadow-inner">
                                      <Users className="text-emerald-500" size={24} />
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-2 text-center">
                                    <h4 className="font-bold text-[8px] sm:text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-emerald-500 dark:text-emerald-400">Human Capital</h4>
                                </div>
                            </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Explainer Cards (Takes 2/5 width on desktop, stacked vertically) */}
                    <div className="lg:col-span-2 flex flex-col gap-4 justify-center">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl flex flex-col gap-2 shadow-sm">
                            <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 font-bold uppercase text-xs tracking-widest"><Zap size={18}/> Corporate Adoption</div>
                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">Firms join via <strong>Surplus Participation Agreements</strong>. Early movers bypass subsistence deflation by ensuring market purchasing power remains stable.</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl flex flex-col gap-2 shadow-sm">
                            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 font-bold uppercase text-xs tracking-widest"><LinkIcon size={18}/> Immutable Distribution</div>
                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">The <strong>Dividend Ledger</strong> uses zero-knowledge verification to move productivity gains directly from the machine layer to human citizens.</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl flex flex-col gap-2 shadow-sm">
                            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 font-bold uppercase text-xs tracking-widest"><Users size={18}/> Resilience Feedback</div>
                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">When survival is decoupled from labor, <strong>Human Capital</strong> pivots to higher-order creativity, creating the stable environment for AI.</p>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'equations' && (
            <div className="max-w-4xl mx-auto py-6 lg:py-12 space-y-8 lg:space-y-12">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-8">
                    <div><h2 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">Model Equations</h2><p className="text-slate-500 font-medium tracking-wide text-sm">The mathematical foundations of non-linear abundance.</p></div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button onClick={() => setEqMode('simple')} className={`px-4 py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${eqMode === 'simple' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Simplified</button>
                        <button onClick={() => setEqMode('complex')} className={`px-4 py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${eqMode === 'complex' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Academic</button>
                    </div>
                </div>
                
                <div className="grid gap-6 lg:gap-10">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 lg:p-10 rounded-3xl lg:rounded-[3rem] group hover:border-blue-500/40 transition-all duration-700 shadow-sm">
                        <h4 className="text-slate-500 mb-6 lg:mb-8 text-[10px] uppercase font-bold tracking-[0.4em] flex items-center gap-2"><Hash size={12}/> Productivity Surplus Flow</h4>
                        {eqMode === 'simple' ? (
                            <div className="text-lg lg:text-2xl text-blue-600 dark:text-blue-400 font-light leading-relaxed">Surplus = (Automation ^ 1.6) × Network Effect × Regional GDP</div>
                        ) : (
                          <MathEq>
                            <span className="text-slate-900 dark:text-white">S(t) = </span>
                            <div className="flex flex-col items-center text-slate-900 dark:text-white">
                              <span>A(t)<sup>1.6</sup></span>
                            </div>
                            <span className="mx-1 text-slate-900 dark:text-white">·</span>
                            <span className="text-slate-900 dark:text-white">P<sub>c</sub></span>
                            <span className="mx-1 text-slate-900 dark:text-white">·</span>
                            <span className="text-slate-900 dark:text-white">G<sub>base</sub></span>
                            <span className="mx-1 text-slate-900 dark:text-white">·</span>
                            <span className="text-slate-900 dark:text-white">(1 + ω · A)</span>
                          </MathEq>
                        )}
                        <p className="mt-6 text-xs text-slate-500 italic border-l-2 border-slate-200 dark:border-slate-800 pl-4">Defines the non-linear growth of value as AI adoption reaches critical mass.</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 lg:p-10 rounded-3xl lg:rounded-[3rem] group hover:border-emerald-500/40 transition-all duration-700 shadow-sm">
                        <h4 className="text-slate-500 mb-6 lg:mb-8 text-[10px] uppercase font-bold tracking-[0.4em] flex items-center gap-2"><Hash size={12}/> Marginal Utility of Dividend</h4>
                        {eqMode === 'simple' ? (
                            <div className="text-lg lg:text-2xl text-emerald-600 dark:text-emerald-400 font-light leading-relaxed">Boost = Adjusted Dividend ÷ (Local Wealth Floor + Constant)</div>
                        ) : (
                          <MathEq>
                            <span className="text-slate-900 dark:text-white">ΔU = </span>
                            <Frac n={<span className="text-slate-900 dark:text-white">D<sub>adj</sub></span>} d={<span className="text-slate-900 dark:text-white">G<sub>cap</sub> + κ</span>} />
                            <span className="mx-1 text-slate-900 dark:text-white">·</span>
                            <span className="text-slate-900 dark:text-white">Scale</span>
                          </MathEq>
                        )}
                        <p className="mt-6 text-xs text-slate-500 italic border-l-2 border-slate-200 dark:border-slate-800 pl-4">Explains why the dividend is transformational for lower-GDP nations and supportive for high-GDP ones.</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 lg:p-10 rounded-3xl lg:rounded-[3rem] group hover:border-amber-500/40 transition-all duration-700 shadow-sm">
                        <h4 className="text-slate-500 mb-6 lg:mb-8 text-[10px] uppercase font-bold tracking-[0.4em] flex items-center gap-2"><Hash size={12}/> GDP Gradient Adjustment</h4>
                        {eqMode === 'simple' ? (
                            <div className="text-lg lg:text-2xl text-amber-600 dark:text-amber-400 font-light leading-relaxed">Adjusted Dividend = Base Payout × (1 + GDP Scaling Factor)</div>
                        ) : (
                          <MathEq>
                            <span className="text-slate-900 dark:text-white">D<sub>adj</sub> = </span>
                            <span className="text-slate-900 dark:text-white">D<sub>base</sub></span>
                            <span className="mx-1 text-slate-900 dark:text-white">·</span>
                            <span className="text-slate-900 dark:text-white">(1 + λ · log(G<sub>cap</sub>))</span>
                          </MathEq>
                        )}
                        <p className="mt-6 text-xs text-slate-500 italic border-l-2 border-slate-200 dark:border-slate-800 pl-4">Corrects for cost-of-living disparities to prevent "Two-Speed World" collapse scenarios.</p>
                    </div>
                </div>
            </div>
          )}
        </section>
      </main>

      <footer className="px-4 lg:px-6 py-3 lg:py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky bottom-0 z-[100] backdrop-blur-md shrink-0">
        <SimulationControls isPlaying={isPlaying} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onReset={handleReset} onStep={stepSimulation} speed={speed} setSpeed={setSpeed} month={state.month} maxMonth={history.length > 0 ? Math.max(...history.map(h => h.month)) : state.month} onSeek={handleSeek} />
      </footer>
    </div>
  );
};

export default App;

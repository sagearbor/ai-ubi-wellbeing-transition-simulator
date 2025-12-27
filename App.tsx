
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Globe, TrendingUp, TrendingDown, Sparkles, Share2, ChevronDown, BrainCircuit, FlaskConical, Database, MousePointer2, PlayCircle, Menu, X, BookOpen, Lightbulb, ArrowRight, ArrowLeft, Info, FileText, Sun, Moon, Copy, Settings, Download, Upload } from 'lucide-react';
import WorldMap from './components/WorldMap';
import SimulationControls from './components/SimulationControls';
import MotionChart from './components/MotionChart';
import CorporationList from './components/CorporationList';
import CorporationDetailPanel from './components/CorporationDetailPanel';
import CountryDetailPanel from './components/CountryDetailPanel';
import GameTheoryVisualization from './components/GameTheoryVisualization';
import { SimulationState, ModelParameters, HistoryPoint, CountryStats, Corporation, GlobalLedger, GameTheoryState, SavedState, SelectedEntity } from './types';
import { PRESET_MODELS, INITIAL_COUNTRIES, INITIAL_CORPORATIONS, SCENARIO_PRESETS } from './constants';
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
            title: "Welcome to the UBI Transition Simulator",
            text: "This models the transition to an AI-powered economy where corporations voluntarily fund Universal Basic Income through enlightened self-interest.",
            pos: "top-1/4 left-1/2 -translate-x-1/2",
            target: null
        },
        {
            title: "Corporations Drive UBI, Not Governments",
            text: "Unlike traditional models, this simulator shows how corporations generate AI revenue by automating jobs, then contribute to a global UBI fund to preserve their customer base. No governments required.",
            pos: "top-1/3 left-1/2 -translate-x-1/2",
            target: null
        },
        {
            title: "AI Revenue & Customer Demand",
            text: "Corporations earn revenue from AI automation, BUT their profits depend on customers being able to afford products. If people lose jobs to AI and can't buy anything, corporate revenue collapses. This creates a self-interest incentive for UBI.",
            pos: "top-1/3 left-1/2 -translate-x-1/2",
            target: null
        },
        {
            title: "Three Distribution Strategies",
            text: "Corporations choose how to distribute UBI: GLOBAL (equal to all humans), CUSTOMER-WEIGHTED (prioritize their markets), or HQ-LOCAL (only their home country). Each has different economic effects.",
            pos: "top-1/3 left-1/2 -translate-x-1/2",
            target: null
        },
        {
            title: "Adaptive Policies & Game Theory",
            text: "Corporations adapt their policies based on market conditions. If customer wellbeing drops (demand collapse risk), smart corporations increase UBI contributions. This creates prisoner's dilemma dynamics: cooperate or defect?",
            pos: "top-1/3 left-1/2 -translate-x-1/2",
            target: null
        },
        {
            title: "Corporations Tab",
            text: "Click the Corporations tab to see all 90+ corporations, their contribution rates, strategies, and game theory dynamics. The cooperation meter shows if we're in a virtuous cycle or race to the bottom.",
            pos: "top-20 right-20",
            target: "tabs"
        },
        {
            title: "Map Views",
            text: "The map shows four views: AI Adoption (blue), Wellbeing (green/red), UBI Received (green), and Corp HQs (purple). Click countries to select them, Shift+click to invest in AI growth.",
            pos: "bottom-32 left-1/2 -translate-x-1/2",
            target: "toggle"
        },
        {
            title: "Playback Controls",
            text: "Press Play to start the simulation. You can pause, speed up, or rewind to any point. Change parameters and press Play again to branch into an alternate future.",
            pos: "bottom-24 left-1/2 -translate-x-1/2",
            target: "bottom"
        },
        {
            title: "Parameters & Scenarios",
            text: "Use the sidebar to adjust economic constants and corporate behavior. Or try one of the scenario presets: Free Market Optimism, Race to Bottom, US Protectionism, etc.",
            pos: "top-1/3 left-16 md:left-80",
            target: "sidebar"
        },
        {
            title: "Charts & AI Analysis",
            text: "The Charts tab shows wellbeing trends and fund accumulation. Use the AI Summary and Red Team buttons to generate detailed analysis of the simulation outcomes.",
            pos: "top-20 right-20",
            target: "tabs"
        },
        {
            title: "Start Exploring!",
            text: "Press Play and watch how corporations respond to market pressures. Will they cooperate to maintain customer wellbeing, or defect into a race to the bottom? The choice is theirs.",
            pos: "top-1/4 left-1/2 -translate-x-1/2",
            target: null
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
  const [activeTab, setActiveTab] = useState<'map' | 'charts' | 'corporations' | 'analysis' | 'overview' | 'equations' | 'guide'>('map');
  const [viewMode, setViewMode] = useState<'adoption' | 'wellbeing'>('wellbeing'); // Default to wellbeing
  const [equationViewMode, setEquationViewMode] = useState<'simple' | 'detailed'>('simple');
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null); // Archetype filter for map

  // Comparison mode state (P7-T5)
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonScenarioId, setComparisonScenarioId] = useState<string>('race-to-bottom');

  // Initialize default selected countries
  const [selectedCountries, setSelectedCountries] = useState<string[]>(() => {
    const defaults = ['Global', 'USA', 'CHN', 'IND'];
    // Add 2 random others
    const candidates = INITIAL_COUNTRIES.filter(c => !defaults.includes(c.id));
    for (let i = 0; i < 2; i++) {
        if (candidates.length > 0) {
            const idx = Math.floor(Math.random() * candidates.length);
            defaults.push(candidates[idx].id);
            candidates.splice(idx, 1);
        }
    }
    return defaults;
  });

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
  
  // Theme State - Defaulting to 'dark' and using a new key to reset user preferences
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('sim_theme_v1');
        return (saved as 'dark' | 'light') || 'dark';
    }
    return 'dark';
  });

  // Tour State
  const [tourStep, setTourStep] = useState<number | null>(null);

  // Unified entity selection state (replaces selectedCorpId)
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);

  // Multi-select state for bulk editing corporations
  const [selectedCorpIds, setSelectedCorpIds] = useState<Set<string>>(new Set());

  // Apply Theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('sim_theme_v1', theme);
  }, [theme]);

  // Auto-switch tabs during tour
  useEffect(() => {
    // Step 5: Corporations Tab
    if (tourStep === 5) {
        setActiveTab('corporations');
    }
    // Steps 6-7: Map Tab (Map Views, Playback Controls)
    else if (tourStep === 6 || tourStep === 7) {
        setActiveTab('map');
    }
    // Step 9: Charts Tab (Charts & AI Analysis)
    else if (tourStep === 9) {
        setActiveTab('charts');
    }
    // All other steps: default to map
    else if (tourStep !== null && tourStep !== 5 && tourStep !== 9) {
        setActiveTab('map');
    }
  }, [tourStep]);

  const getInitialState = useCallback((): SimulationState => {
    const initialCountryData: Record<string, CountryStats> = {};
    INITIAL_COUNTRIES.forEach(c => {
      initialCountryData[c.id] = {
        ...c,
        aiAdoption: 0.01,
        wellbeing: Math.min(100, Math.max(10, c.gdpPerCapita / 1200 + 40)),
        companiesJoined: 0,
        displacementGap: 0,
        // Corporation-centric tracking fields (P5-T6)
        headquarteredCorps: [],
        customerOfCorps: [],
        ubiReceivedGlobal: 0,
        ubiReceivedLocal: 0,
        ubiReceivedCustomerWeighted: 0,
        totalUbiReceived: 0,
        nationalPolicy: {
          allowsDirectWallet: c.governance > 0.4, // Authoritarian regimes may block
          localTaxOnUbi: 0,
          corporateIncentives: 0
        },
        wellbeingTrend: []
      };
    });
    // Shadow state starts identical - will diverge with no intervention
    const shadowCountryData = JSON.parse(JSON.stringify(initialCountryData));

    return {
      month: 0,
      globalFund: 0,
      averageWellbeing: 50,
      totalAiCompanies: 0,
      countryData: initialCountryData,
      // New tracking fields
      shadowCountryData,
      globalDisplacementGap: 0,
      corruptionLeakage: 0,
      countriesInCrisis: 0
    };
  }, []);

  const [state, setState] = useState<SimulationState>(getInitialState());
  const [corporations, setCorporations] = useState<Corporation[]>(INITIAL_CORPORATIONS);
  const [globalLedger, setGlobalLedger] = useState<GlobalLedger>({
    totalFunds: 0,
    monthlyInflow: 0,
    monthlyOutflow: 0,
    fundsPerCapita: 0,
    fundsByCountry: {},
    contributorBreakdown: {},
    distributionBreakdown: {},
    corruptionLeakage: 0
  });
  const [gameTheoryState, setGameTheoryState] = useState<GameTheoryState>({
    isInPrisonersDilemma: false,
    defectionCount: 0,
    cooperationCount: 0,
    moderateCount: 0,
    raceToBottomRisk: 0,
    virtuousCycleStrength: 0,
    avgContributionRate: 0
  });

  // Comparison simulation state (P7-T5) - second parallel simulation
  const [comparisonState, setComparisonState] = useState<SimulationState>(getInitialState());
  const [comparisonCorporations, setComparisonCorporations] = useState<Corporation[]>(INITIAL_CORPORATIONS);
  const [comparisonLedger, setComparisonLedger] = useState<GlobalLedger>({
    totalFunds: 0,
    monthlyInflow: 0,
    monthlyOutflow: 0,
    fundsPerCapita: 0,
    fundsByCountry: {},
    contributorBreakdown: {},
    distributionBreakdown: {},
    corruptionLeakage: 0
  });
  const [comparisonGameTheory, setComparisonGameTheory] = useState<GameTheoryState>({
    isInPrisonersDilemma: false,
    defectionCount: 0,
    cooperationCount: 0,
    moderateCount: 0,
    raceToBottomRisk: 0,
    virtuousCycleStrength: 0,
    avgContributionRate: 0
  });
  const [comparisonModel, setComparisonModel] = useState<ModelParameters>(PRESET_MODELS[0]);

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
    // Reset corporations and global ledger (P5-T6)
    setCorporations(INITIAL_CORPORATIONS);
    setGlobalLedger({
      totalFunds: 0,
      monthlyInflow: 0,
      monthlyOutflow: 0,
      fundsPerCapita: 0,
      fundsByCountry: {},
      contributorBreakdown: {},
      distributionBreakdown: {},
      corruptionLeakage: 0
    });
    // Reset game theory state (P6-T4)
    setGameTheoryState({
      isInPrisonersDilemma: false,
      defectionCount: 0,
      cooperationCount: 0,
      moderateCount: 0,
      raceToBottomRisk: 0,
      virtuousCycleStrength: 0,
      avgContributionRate: 0
    });
    window.history.pushState("", document.title, window.location.pathname + window.location.search);
  }, [getInitialState]);

  // ============================================================================
  // UPDATE CORPORATION (P5-T10)
  // ============================================================================
  // Allows updating individual corporation properties (e.g., from detail panel)
  // ============================================================================

  const updateCorporation = useCallback((id: string, updates: Partial<Corporation>) => {
    setCorporations(prevCorps =>
      prevCorps.map(corp =>
        corp.id === id ? { ...corp, ...updates } : corp
      )
    );
  }, []);

  // ============================================================================
  // UPDATE COUNTRY (P7-T2)
  // ============================================================================
  // Allows updating individual country properties (e.g., from detail panel)
  // ============================================================================

  const updateCountry = useCallback((id: string, updates: Partial<CountryStats>) => {
    setState(prevState => ({
      ...prevState,
      countryData: {
        ...prevState.countryData,
        [id]: {
          ...prevState.countryData[id],
          ...updates
        }
      }
    }));
  }, []);

  // ============================================================================
  // SCENARIO PRESETS (P7-T4)
  // ============================================================================
  // Apply pre-configured scenarios that set up specific game theory conditions
  // ============================================================================

  /**
   * Apply a scenario preset: updates model parameters and corporation policies,
   * then resets the simulation to month 0 to start fresh with the new configuration.
   */
  const applyScenario = useCallback((scenarioId: string) => {
    const scenario = SCENARIO_PRESETS.find(s => s.id === scenarioId);
    if (!scenario) {
      console.error(`Scenario ${scenarioId} not found`);
      return;
    }

    // 1. Update model parameters with scenario's settings
    const updatedModel = { ...model, ...scenario.modelParams };
    setModel(updatedModel);

    // 2. Apply corporation overrides
    const updatedCorps = INITIAL_CORPORATIONS.map(corp => {
      let updated = { ...corp };

      // Apply each override filter
      scenario.corporationOverrides?.forEach(override => {
        if (override.filter(corp)) {
          updated = { ...updated, ...override.updates };
        }
      });

      return updated;
    });
    setCorporations(updatedCorps);

    // 3. Reset simulation to month 0
    handleReset();

    console.log(`Applied scenario: ${scenario.name}`);
  }, [model, handleReset]);

  // ============================================================================
  // COMPARISON SCENARIO APPLICATION (P7-T5)
  // ============================================================================
  // Apply scenario to comparison state when comparisonScenarioId changes
  // ============================================================================

  useEffect(() => {
    if (!comparisonMode) return;

    const scenario = SCENARIO_PRESETS.find(s => s.id === comparisonScenarioId);
    if (!scenario) return;

    // 1. Update comparison model with scenario's settings
    const updatedModel = { ...PRESET_MODELS[0], ...scenario.modelParams };
    setComparisonModel(updatedModel);

    // 2. Apply corporation overrides to comparison corps
    const updatedCorps = INITIAL_CORPORATIONS.map(corp => {
      let updated = { ...corp };

      scenario.corporationOverrides?.forEach(override => {
        if (override.filter(corp)) {
          updated = { ...updated, ...override.updates };
        }
      });

      return updated;
    });
    setComparisonCorporations(updatedCorps);

    // 3. Reset comparison state to month 0
    setComparisonState(getInitialState());
    setComparisonLedger({
      totalFunds: 0,
      monthlyInflow: 0,
      monthlyOutflow: 0,
      fundsPerCapita: 0,
      fundsByCountry: {},
      contributorBreakdown: {},
      distributionBreakdown: {},
      corruptionLeakage: 0
    });
    setComparisonGameTheory({
      isInPrisonersDilemma: false,
      defectionCount: 0,
      cooperationCount: 0,
      moderateCount: 0,
      raceToBottomRisk: 0,
      virtuousCycleStrength: 0,
      avgContributionRate: 0
    });

    console.log(`Applied comparison scenario: ${scenario.name}`);
  }, [comparisonMode, comparisonScenarioId, getInitialState]);

  // ============================================================================
  // SAVE/LOAD FUNCTIONALITY (P6-T8)
  // ============================================================================
  // Save and load complete simulation state to/from JSON files
  // Enables scenario sharing, checkpointing, and restoration
  // ============================================================================

  /**
   * Save current simulation state to a JSON file
   * Downloads a timestamped JSON file containing all state
   */
  const saveToFile = useCallback(() => {
    try {
      const savedState: SavedState = {
        version: "2.0",
        timestamp: Date.now(),
        month: state.month,
        corporations,
        countryData: state.countryData,
        globalLedger,
        gameTheoryState,
        model,
        history
      };

      // Create blob and download link
      const blob = new Blob([JSON.stringify(savedState, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ubi-simulation-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('Simulation saved successfully');
    } catch (err) {
      console.error("Failed to save simulation:", err);
      alert("Failed to save simulation. Check console for details.");
    }
  }, [state, corporations, globalLedger, gameTheoryState, model, history]);

  /**
   * Load simulation state from a JSON file
   * Restores all state including history, corporations, and parameters
   */
  const loadFromFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const saved = JSON.parse(e.target?.result as string) as SavedState;

        // Validate version compatibility
        if (!saved.version || saved.version !== "2.0") {
          console.warn(`Loading save file version ${saved.version || 'unknown'}. Current version is 2.0. May have compatibility issues.`);
        }

        // Restore all state
        setState(prev => ({
          ...prev,
          month: saved.month,
          countryData: saved.countryData,
          globalFund: saved.globalLedger.totalFunds,
          averageWellbeing: Object.values(saved.countryData).reduce((sum, c) => sum + c.wellbeing, 0) / Object.values(saved.countryData).length,
          totalAiCompanies: saved.corporations.length,
          // Preserve shadow data if not in save (for backwards compatibility)
          shadowCountryData: saved.countryData, // Use same as main for now
          globalDisplacementGap: prev.globalDisplacementGap,
          corruptionLeakage: 0,
          countriesInCrisis: prev.countriesInCrisis
        }));

        setCorporations(saved.corporations);
        setGlobalLedger(saved.globalLedger);
        setGameTheoryState(saved.gameTheoryState);
        setModel(saved.model);
        setHistory(saved.history || []);

        // Stop playback on load
        setIsPlaying(false);

        console.log(`Simulation loaded successfully from ${new Date(saved.timestamp).toLocaleString()}`);
      } catch (err) {
        console.error("Failed to load save file:", err);
        alert("Failed to load save file. The file may be corrupted or incompatible.");
      }
    };
    reader.readAsText(file);

    // Reset the input so the same file can be loaded again
    event.target.value = '';
  }, []);

  // ============================================================================
  // CORPORATION REVENUE MODEL (P5-T7)
  // ============================================================================
  // Calculate AI revenue for each corporation based on automation level and
  // customer purchasing power. This creates the KEY INSIGHT: corporations have
  // SELF-INTEREST in UBI because poor customers can't buy products.
  // ============================================================================

  const calculateAiRevenue = useCallback((
    corp: Corporation,
    countries: Record<string, CountryStats>
  ): number => {
    // Base revenue from AI automation
    // Formula: adoption level × market cap × 15% (industry standard for AI revenue as % of market cap)
    const automationRevenue = corp.aiAdoptionLevel * corp.marketCap * 0.15;

    // Revenue depends on customer purchasing power
    // If customers are poor, they can't buy products
    let customerDemand = 0;
    corp.operatingCountries.forEach(countryId => {
      const country = countries[countryId];
      if (!country) return;

      // Purchasing power = GDP per capita × wellbeing adjustment
      // Higher wellbeing = more discretionary spending on tech/AI products
      const purchasingPower = country.gdpPerCapita * (country.wellbeing / 100);
      customerDemand += purchasingPower * country.population;
    });

    // Revenue scales with demand (poor customers = lower revenue)
    // Demand factor ensures that if customer base collapses, revenue drops proportionally
    // Denominator: marketCap × 10 represents expected baseline customer demand for a company of that size
    const demandFactor = Math.min(1, customerDemand / (corp.marketCap * 10));

    // Reputation affects revenue (customers prefer ethical companies)
    const reputationMultiplier = 0.85 + (corp.reputationScore / 100) * 0.30;

    return automationRevenue * demandFactor * reputationMultiplier;
  }, []);

  // ============================================================================
  // DISTRIBUTION STRATEGIES (P5-T8)
  // ============================================================================
  // Three distribution functions that corporations can choose from.
  // Each strategy has different economic and game-theoretic implications.
  // ============================================================================

  // STRATEGY 1: GLOBAL DISTRIBUTION
  // Most altruistic - funds go to global ledger for equal per-capita distribution worldwide
  // Benefits: Maximum reputation boost, helps stabilize global economy
  // Drawbacks: Less direct benefit to corporation's own customer base
  const distributeGlobal = useCallback((
    contribution: number,
    globalLedger: GlobalLedger
  ): void => {
    globalLedger.totalFunds += contribution;
    globalLedger.monthlyInflow += contribution;
    // Funds will be distributed equally per capita worldwide in the next phase
  }, []);

  // STRATEGY 2: CUSTOMER-WEIGHTED DISTRIBUTION
  // Enlightened self-interest - distribute proportional to where customers are
  // Benefits: Directly strengthens customer base purchasing power
  // Drawbacks: Less global impact, may ignore poor regions without customers
  const distributeCustomerWeighted = useCallback((
    corp: Corporation,
    contribution: number,
    countries: Record<string, CountryStats>
  ): void => {
    // Calculate total customer population across all operating countries
    const totalCustomerPop = corp.operatingCountries.reduce((sum, countryId) => {
      const country = countries[countryId];
      return country ? sum + country.population : sum;
    }, 0);

    if (totalCustomerPop === 0) return; // Safety check

    // Distribute proportional to customer base in each country
    corp.operatingCountries.forEach(countryId => {
      const country = countries[countryId];
      if (!country) return;

      const share = country.population / totalCustomerPop;
      const countryContribution = contribution * share;

      // Track customer-weighted UBI separately (for analytics/visualization)
      if (!country.ubiReceivedCustomerWeighted) {
        country.ubiReceivedCustomerWeighted = 0;
      }
      country.ubiReceivedCustomerWeighted += countryContribution;
    });
  }, []);

  // STRATEGY 3: HQ-LOCAL DISTRIBUTION
  // Most selfish - all contribution goes to headquarters country only
  // Benefits: Maximizes local political support, "take care of our own"
  // Drawbacks: Poor reputation, doesn't help global customer base, nationalist optics
  const distributeHqLocal = useCallback((
    corp: Corporation,
    contribution: number,
    countries: Record<string, CountryStats>
  ): void => {
    const hqCountry = countries[corp.headquartersCountry];
    if (!hqCountry) return; // Safety check

    // All contribution goes to HQ country
    if (!hqCountry.ubiReceivedLocal) {
      hqCountry.ubiReceivedLocal = 0;
    }
    hqCountry.ubiReceivedLocal += contribution;
  }, []);

  // ============================================================================
  // P6-T1: DEMAND COLLAPSE PROJECTION
  // ============================================================================
  // Corporations project future demand based on customer wellbeing trends.
  // This drives corporate self-interest: if customers are getting poorer,
  // corporations LOSE REVENUE. UBI maintains their customer base.

  function extrapolateTrend(trend: number[], monthsAhead: number): number {
    if (trend.length < 2) return trend[0] || 50;
    const recentChange = trend[trend.length - 1] - trend[0];
    const monthlyChange = recentChange / trend.length;
    return Math.max(0, Math.min(100, trend[trend.length - 1] + monthlyChange * monthsAhead));
  }

  function projectDemandCollapse(corp: Corporation, countries: Record<string, CountryStats>): number {
    let currentDemand = 0;
    let projectedDemand = 0;

    corp.operatingCountries.forEach(countryId => {
      const country = countries[countryId];
      if (!country) return;

      // Current demand
      currentDemand += country.population * country.gdpPerCapita * (country.wellbeing / 100);

      // Projected demand (if wellbeing continues declining)
      const trend = country.wellbeingTrend || [country.wellbeing];
      const projectedWellbeing = extrapolateTrend(trend, 12); // 12 months ahead
      projectedDemand += country.population * country.gdpPerCapita * (projectedWellbeing / 100);
    });

    // Collapse % = how much demand will drop
    return currentDemand > 0 ? Math.max(0, (currentDemand - projectedDemand) / currentDemand) : 0;
  }

  // ============================================================================
  // P6-T2: CORPORATION ADAPTIVE POLICY
  // ============================================================================
  // Corporations auto-adjust policy based on market conditions.
  // Implements enlightened self-interest: saving customer base = saving revenue.

  function adaptCorporationPolicy(corp: Corporation, countries: Record<string, CountryStats>, currentMonth: number): void {
    // Only adapt if enabled (check corp.policy or a default)
    const demandCollapse = projectDemandCollapse(corp, countries);

    // Store for UI display
    corp.projectedDemandCollapse = demandCollapse;

    // SELF-INTEREST TRIGGER: If customers are getting poor, increase UBI
    if (demandCollapse > 0.15) { // 15% projected collapse threshold
      corp.contributionRate = Math.min(0.50, corp.contributionRate + 0.02);
      if (corp.distributionStrategy === 'hq-local') {
        corp.distributionStrategy = 'customer-weighted';
      }
      corp.policyStance = 'generous';
      corp.lastPolicyChange = currentMonth;
    }

    // REPUTATION TRIGGER: If reputation drops below 30, increase generosity
    if (corp.reputationScore < 30) {
      corp.contributionRate = Math.min(0.50, corp.contributionRate + 0.01);
      corp.policyStance = corp.contributionRate > 0.20 ? 'generous' : 'moderate';
    }

    // RECOVERY: If demand stable and reputation high, slight relaxation allowed
    if (demandCollapse < 0.05 && corp.reputationScore > 70) {
      corp.contributionRate = Math.max(0.05, corp.contributionRate - 0.005);
    }
  }

  // ============================================================================
  // P6-T3: COMPETITOR AWARENESS (NASH EQUILIBRIUM)
  // ============================================================================
  // Corporations observe and respond to competitors in shared markets.
  // Implements Nash equilibrium dynamics: tendency to match competitor behavior.

  function respondToCompetitors(corp: Corporation, allCorps: Corporation[]): void {
    // Find competitors (same markets)
    const competitors = allCorps.filter(c =>
      c.id !== corp.id &&
      c.operatingCountries.some(country => corp.operatingCountries.includes(country))
    );

    if (competitors.length === 0) return;

    // Calculate average competitor contribution
    const avgCompetitorRate = competitors.reduce((sum, c) => sum + c.contributionRate, 0) / competitors.length;

    // NASH DYNAMICS: Tendency to match competitors
    const rateDiff = avgCompetitorRate - corp.contributionRate;

    if (rateDiff > 0.10) {
      // Competitors are more generous - reputation pressure to catch up
      corp.reputationScore = Math.max(0, corp.reputationScore - 2);
      // Slowly catch up
      corp.contributionRate = Math.min(0.50, corp.contributionRate + 0.01);
    } else if (rateDiff < -0.10) {
      // We're more generous than competitors - reputation boost
      corp.reputationScore = Math.min(100, corp.reputationScore + 1);
    }
  }

  // ============================================================================
  // P6-T5: REPUTATION SYSTEM
  // ============================================================================
  // Reputation affects customer preference and is based on relative generosity.
  // Creates positive feedback loop for ethical corporate behavior.

  function updateReputation(corp: Corporation, allCorps: Corporation[]): void {
    // Reputation based on relative generosity
    const avgContribution = allCorps.reduce((s, c) => s + c.contributionRate, 0) / allCorps.length;

    if (corp.contributionRate > avgContribution * 1.2) {
      // Very generous - reputation boost
      corp.reputationScore = Math.min(100, corp.reputationScore + 2);
    } else if (corp.contributionRate < avgContribution * 0.8) {
      // Selfish - reputation penalty
      corp.reputationScore = Math.max(0, corp.reputationScore - 3);
    } else {
      // Average - slight drift toward 50
      if (corp.reputationScore > 50) {
        corp.reputationScore -= 0.5;
      } else {
        corp.reputationScore += 0.5;
      }
    }

    // Update policy stance based on contribution rate
    if (corp.contributionRate >= 0.25) {
      corp.policyStance = 'generous';
    } else if (corp.contributionRate >= 0.12) {
      corp.policyStance = 'moderate';
    } else {
      corp.policyStance = 'selfish';
    }
  }

  // ============================================================================
  // P6-T4: PRISONER'S DILEMMA DETECTION
  // ============================================================================
  // Analyzes game theory dynamics across all corporations to detect
  // race-to-bottom scenarios vs virtuous cooperation cycles.

  function analyzeGameTheory(corps: Corporation[]): GameTheoryState {
    const defectors = corps.filter(c => c.policyStance === 'selfish').length;
    const cooperators = corps.filter(c => c.policyStance === 'generous').length;
    const moderates = corps.filter(c => c.policyStance === 'moderate').length;
    const total = corps.length;

    const avgContribution = corps.reduce((s, c) => s + c.contributionRate, 0) / total;

    // Race to bottom: if >40% defect, others feel pressure to defect
    const raceToBottomRisk = defectors > total * 0.4 ?
      (defectors - total * 0.4) / (total * 0.6) : 0;

    // Virtuous cycle: if >60% cooperate, others feel pressure to cooperate
    const virtuousCycleStrength = cooperators > total * 0.6 ?
      (cooperators - total * 0.6) / (total * 0.4) : 0;

    return {
      isInPrisonersDilemma: raceToBottomRisk > 0.3 && virtuousCycleStrength < 0.3,
      defectionCount: defectors,
      cooperationCount: cooperators,
      moderateCount: moderates,
      raceToBottomRisk: Math.min(1, raceToBottomRisk),
      virtuousCycleStrength: Math.min(1, virtuousCycleStrength),
      avgContributionRate: avgContribution
    };
  }

  // ============================================================================
  // P6-T6: US-SPECIFIC ADAPTIVE BEHAVIOR
  // ============================================================================
  // Models how US-based corporations respond when US wellbeing drops.
  // US corporations tend to respond to domestic political pressure and patriotic appeals.
  // They may shift from global strategies to prioritizing US markets when home country suffers.

  function usCorpAdaptation(corp: Corporation, countries: Record<string, CountryStats>): void {
    if (corp.headquartersCountry !== 'usa') return;

    const usData = countries['usa'];
    if (!usData) return;

    const usWellbeing = usData.wellbeing;
    const usWellbeingTrend = usData.wellbeingTrend || [usWellbeing];

    // Check if US wellbeing is declining (compare latest vs first in trend)
    const isDecreasing = usWellbeingTrend.length >= 2 &&
      usWellbeingTrend[usWellbeingTrend.length - 1] < usWellbeingTrend[0];

    // If US is suffering, US corps may prioritize US
    if (usWellbeing < 50 && isDecreasing) {
      if (usWellbeing < 30) {
        // Desperation mode - switch to local only
        // Political pressure, "America First" rhetoric, protect domestic jobs
        corp.distributionStrategy = 'hq-local';
        corp.policyStance = 'selfish';
      } else if (usWellbeing < 50 && corp.distributionStrategy === 'global') {
        // Concern mode - switch to customer-weighted (US is a major customer)
        // Balances domestic concerns with global markets
        corp.distributionStrategy = 'customer-weighted';
      }
    }

    // Recovery: If US is doing well again, can return to global
    if (usWellbeing > 70 && corp.distributionStrategy === 'hq-local') {
      corp.distributionStrategy = 'customer-weighted';
      corp.policyStance = 'moderate';
    }
  }

  // ============================================================================
  // P6-T6: CHINA-SPECIFIC ADAPTIVE BEHAVIOR
  // ============================================================================
  // Models how Chinese corporations respond to domestic conditions.
  // Chinese corps tend to be more protectionist by default due to state influence.
  // They respond to domestic pressure more than global reputation concerns.

  function chinaCorpAdaptation(corp: Corporation, countries: Record<string, CountryStats>): void {
    if (corp.headquartersCountry !== 'chn') return;

    const chinaData = countries['chn'];
    if (!chinaData) return;

    // Chinese corporations tend to be more responsive to state priorities
    // and domestic stability concerns (CCP influence)
    if (chinaData.wellbeing < 40) {
      // Domestic crisis - state pressure to support Chinese citizens
      corp.distributionStrategy = 'hq-local';
      corp.policyStance = 'selfish';
    } else if (chinaData.wellbeing < 60) {
      // Moderate concerns - customer-weighted gives some global engagement
      // while maintaining focus on Chinese markets
      if (corp.distributionStrategy === 'global') {
        corp.distributionStrategy = 'customer-weighted';
      }
    }
  }

  // ============================================================================
  // P6-T6: EU-SPECIFIC ADAPTIVE BEHAVIOR
  // ============================================================================
  // Models how European corporations respond to regional conditions.
  // EU corps tend to be more cooperative and socially-conscious by default.
  // Strong regulatory environment and social contract traditions.

  function euCorpAdaptation(corp: Corporation, countries: Record<string, CountryStats>): void {
    // Check if HQ is in major EU countries
    const euCountries = ['deu', 'fra', 'gbr', 'ita', 'esp', 'nld', 'swe', 'che'];
    if (!euCountries.includes(corp.headquartersCountry)) return;

    // Calculate average EU wellbeing
    let totalEuWellbeing = 0;
    let euCountryCount = 0;

    euCountries.forEach(id => {
      const country = countries[id];
      if (country) {
        totalEuWellbeing += country.wellbeing;
        euCountryCount++;
      }
    });

    const avgEuWellbeing = euCountryCount > 0 ? totalEuWellbeing / euCountryCount : 50;

    // EU corps tend to be more globally-minded due to regulatory environment
    // and social democracy traditions, but will protect EU if necessary
    if (avgEuWellbeing < 40) {
      // EU-wide crisis - regional protectionism
      if (corp.distributionStrategy === 'global') {
        corp.distributionStrategy = 'customer-weighted';
      }
    } else if (avgEuWellbeing > 65 && corp.contributionRate < 0.20) {
      // When doing well, EU corps face pressure to be more generous
      // Social contract and regulatory expectations
      corp.contributionRate = Math.min(0.50, corp.contributionRate + 0.01);
      corp.policyStance = corp.contributionRate >= 0.25 ? 'generous' : 'moderate';
    }
  }
  const stepSimulation = useCallback(() => {
    setState(prev => {
      const nextMonth = prev.month + 1;
      const newCountryData = { ...prev.countryData };
      const newShadowData = { ...prev.shadowCountryData };
      let totalWellbeing = 0;
      let totalDisplacementGap = 0;
      let countriesInCrisis = 0;

      const worldPopulation = INITIAL_COUNTRIES.reduce((a: number, b: any) => a + b.population, 0);

      // ============================================================================
      // CORPORATION-CENTRIC SIMULATION ARCHITECTURE (P5-T6)
      // ============================================================================
      //
      // DESIGN PHILOSOPHY:
      // - Corporations voluntarily contribute to UBI (free market solution)
      // - Direct-to-wallet is ALWAYS TRUE (blockchain/crypto infrastructure)
      // - Nation states cannot block - system is government-agnostic
      // - Self-interest drives cooperation (poor customers = lower revenue)
      //
      // PHASE 1: Corporation Revenue Generation
      // PHASE 2: Corporation Contribution Decisions
      // PHASE 3: UBI Distribution to Citizens
      // PHASE 4: Wellbeing Calculation
      // PHASE 5: Corporation Adaptation (future: adaptive policies)
      //
      // KEY COEFFICIENTS (maintained from previous model):
      // - UBI Boost: 0.20 (stability gain in democracies)
      // - Displacement Friction: 0.12 (transition anxiety)
      // - Governance Exponent: 1.5 (institutions buffer pain)
      // - Gini Dampening: 1.5 - gini (inequality reduces UBI utility)
      // - Crisis Penalty Cap: 5 points (adaptation limits)
      //
      // ============================================================================

      // Initialize UBI tracking fields for countries
      Object.keys(newCountryData).forEach(id => {
        const country = newCountryData[id];
        country.ubiReceivedGlobal = 0;
        country.ubiReceivedLocal = 0;
        country.ubiReceivedCustomerWeighted = 0;
        country.totalUbiReceived = 0;
      });

      // Initialize new global ledger for this month
      const newLedger: GlobalLedger = {
        totalFunds: 0,
        monthlyInflow: 0,
        monthlyOutflow: 0,
        fundsPerCapita: 0,
        fundsByCountry: {},
        contributorBreakdown: {},
        distributionBreakdown: {},
        corruptionLeakage: 0
      };

      // ============================================================================
      // PHASE 1: CORPORATION REVENUE GENERATION
      // ============================================================================

      const updatedCorps = corporations.map(corp => {
        // Calculate AI revenue using the helper function
        const aiRevenue = calculateAiRevenue(corp, newCountryData);

        // Update country AI adoption based on corporations operating there
        corp.operatingCountries.forEach(countryId => {
          const country = newCountryData[countryId];
          if (country) {
            const regionalModifier = 1 + (country.gdpPerCapita / 100000);
            const growth = model.aiGrowthRate * regionalModifier * corp.aiAdoptionLevel * 0.1;
            country.aiAdoption = Math.min(0.999, country.aiAdoption + growth * (1 - country.aiAdoption));
          }
        });

        // Calculate customer base wellbeing
        let totalCustomerPop = 0;
        let customerWellbeingSum = 0;

        corp.operatingCountries.forEach(countryId => {
          const country = newCountryData[countryId];
          if (country) {
            totalCustomerPop += country.population;
            customerWellbeingSum += country.wellbeing * country.population;
          }
        });

        const customerBaseWellbeing = totalCustomerPop > 0
          ? customerWellbeingSum / totalCustomerPop
          : 50;

        // Project demand collapse
        const projectedDemandCollapse = customerBaseWellbeing < 40
          ? Math.min(0.8, (50 - customerBaseWellbeing) / 100)
          : 0;

        return {
          ...corp,
          aiRevenue,
          customerBaseWellbeing,
          projectedDemandCollapse
        };
      });

      // ============================================================================
      // PHASE 2: CORPORATION CONTRIBUTION DECISIONS
      // ============================================================================

      updatedCorps.forEach(corp => {
        const contribution = corp.aiRevenue * corp.contributionRate;

        // Track contribution
        newLedger.contributorBreakdown[corp.id] = contribution;
        newLedger.monthlyInflow += contribution;

        // Distribute based on strategy
        if (corp.distributionStrategy === 'global') {
          distributeGlobal(contribution, newLedger);
        } else if (corp.distributionStrategy === 'customer-weighted') {
          distributeCustomerWeighted(corp, contribution, newCountryData);
        } else {
          distributeHqLocal(corp, contribution, newCountryData);
        }
      });

      // ============================================================================
      // PHASE 3: UBI DISTRIBUTION TO CITIZENS
      // ============================================================================

      // Global ledger distributes equally per capita (blockchain, no corruption)
      const globalPerCapita = newLedger.totalFunds / worldPopulation || 0;
      newLedger.fundsPerCapita = globalPerCapita;

      Object.keys(newCountryData).forEach(id => {
        const country = newCountryData[id];
        const shadow = newShadowData[id];

        // ============================================================================
        // PHASE 4: WELLBEING CALCULATION
        // ============================================================================

        // Global UBI (direct-to-wallet, bypasses all corruption)
        country.ubiReceivedGlobal = globalPerCapita * country.population;

        // Calculate total UBI received
        const totalUbiAmount = (country.ubiReceivedGlobal || 0) +
                               (country.ubiReceivedCustomerWeighted || 0) +
                               (country.ubiReceivedLocal || 0);

        country.totalUbiReceived = totalUbiAmount;
        newLedger.fundsByCountry[id] = totalUbiAmount;
        newLedger.monthlyOutflow += totalUbiAmount;

        // Convert to per-capita monthly UBI for calculations
        const totalUBI = country.population > 0
          ? totalUbiAmount / (country.population * 10) // Scale for monthly per capita
          : 0;

        // === 4.1. Gini Dampening (Inequality reduces UBI utility) ===
        const giniDamper = 1.5 - country.gini;
        const effectiveUBI = totalUBI * giniDamper;

        // GDP-weighted utility scaling
        const logGDP = Math.log10(country.gdpPerCapita + 1000);
        const scalingOffset = (logGDP - 4);
        const wealthGradient = 1 + (model.gdpScaling * 0.5 * scalingOffset);
        const scaledUBI = effectiveUBI * Math.max(0.5, wealthGradient);

        const utilityScale = country.gdpPerCapita / 40 + 150;
        const ubiBoost = (scaledUBI / utilityScale) * 120;

        // === 5. Displacement Gap Calculation ===
        const monthlyWage = country.gdpPerCapita / 12;
        const lostWages = monthlyWage * country.aiAdoption * model.displacementRate;
        const displacementGap = Math.max(0, lostWages - totalUBI);
        country.displacementGap = displacementGap;
        totalDisplacementGap += displacementGap * country.population;

        // === 6. Enhanced Displacement Friction with Governance Buffering ===
        // ECONOMIC RATIONALE: Well-governed democracies have better social safety nets,
        // labor retraining programs, and institutions that buffer transition anxiety.
        // Friction increases as a power function (1.5) so low-gov countries feel exponentially more pain.
        const baseFriction = 40 * Math.pow(1 - country.governance, 1.5) * (1 + country.gini * 0.5);
        const displacementFriction = Math.sin(country.aiAdoption * Math.PI) * baseFriction;

        // === 7. Wellbeing Calculation ===
        // REBALANCED COEFFICIENTS:
        // - UBI boost coefficient increased from 0.12 to 0.20 (67% increase)
        // - Displacement friction reduced from 0.24 to 0.12 (50% reduction)
        // RATIONALE: In well-governed economies with functional institutions, UBI should
        // outpace displacement anxiety. Previous 2:1 ratio (friction:boost) was causing
        // unrealistic collapse even in high-functioning democracies.
        let wellbeingBase = country.wellbeing + (ubiBoost * 0.20) - (displacementFriction * 0.12);

        // Crisis detection: displacement gap exceeds 30% of monthly wage
        // CAPPED PENALTY: Even in crisis, societies adapt through informal economies,
        // family networks, and emergency measures. Infinite penalty was unrealistic.
        if (displacementGap > monthlyWage * 0.3) {
          countriesInCrisis++;
          const crisisPenalty = Math.min(5, (displacementGap / monthlyWage) * 10);
          wellbeingBase -= crisisPenalty;
        }

        // Subsistence check with enhanced benefits
        // RATIONALE: When UBI significantly exceeds subsistence, populations thrive with
        // improved nutrition, education, healthcare access. Old +0.8 was too conservative.
        const subsistenceFloor = country.gdpPerCapita / 25;
        if (country.aiAdoption > 0.60 && totalUBI < subsistenceFloor) {
          wellbeingBase -= 1.5;
        } else if (totalUBI > subsistenceFloor * 2.5) {
          wellbeingBase += 2.0; // Increased from 0.8 - thriving societies
        }

        country.wellbeing = Math.max(1, Math.min(100, wellbeingBase));
        totalWellbeing += country.wellbeing;

        // Update wellbeing trend (rolling 6-month window for adaptive mechanisms)
        if (!country.wellbeingTrend) {
          country.wellbeingTrend = [];
        }
        country.wellbeingTrend.push(country.wellbeing);
        if (country.wellbeingTrend.length > 6) {
          country.wellbeingTrend.shift(); // Keep only last 6 months
        }

        // === SHADOW SIMULATION (No Intervention Baseline) ===
        // RATIONALE: This counterfactual shows what happens WITHOUT a UBI system.
        // Should clearly demonstrate that intervention helps, validating the entire model.

        // Slower adoption without incentives (50% speed)
        const regionalModifier = 1 + (country.gdpPerCapita / 100000);
        const shadowGrowth = model.aiGrowthRate * 0.5 * regionalModifier * (1 - shadow.aiAdoption);
        shadow.aiAdoption = Math.min(0.999, shadow.aiAdoption + shadowGrowth);

        // No UBI - wages collapse dramatically with automation (90% displacement)
        const shadowWage = monthlyWage * (1 - shadow.aiAdoption * 0.9);
        const shadowSubsistence = country.gdpPerCapita / 25;

        // Michaelis-Menten wellbeing curve - basic survival economics
        const shadowDemand = shadowWage;
        const subsistenceAdjusted = shadowSubsistence * (shadowDemand < 800 ? 1.7 : 1);
        const r = shadowDemand / (shadowDemand + subsistenceAdjusted);
        shadow.wellbeing = Math.max(1, Math.min(100, r * 100));

        // Shadow displacement friction - STRONGER without UBI buffer
        // No social safety net = worse anxiety and social cohesion breakdown
        const shadowFriction = Math.sin(shadow.aiAdoption * Math.PI) * baseFriction * 2.0;
        shadow.wellbeing = Math.max(1, shadow.wellbeing - shadowFriction * 0.4);

        // Additional penalty for high adoption without safety net
        // RATIONALE: Mass unemployment without UBI leads to social breakdown, riots, instability
        if (shadow.aiAdoption > 0.5) {
          const instabilityPenalty = Math.pow(shadow.aiAdoption - 0.5, 2) * 20;
          shadow.wellbeing = Math.max(1, shadow.wellbeing - instabilityPenalty);
        }

      });

      // ============================================================================
      // PHASE 5: CORPORATION ADAPTATION
      // ============================================================================
      // Corporations adapt their policies based on demand projections and reputation.
      // This implements enlightened self-interest game theory dynamics.

      updatedCorps.forEach(corp => {
        // General adaptive mechanisms (all corporations)
        adaptCorporationPolicy(corp, newCountryData, nextMonth);
        respondToCompetitors(corp, updatedCorps);
        updateReputation(corp, updatedCorps);

        // Country-specific adaptive behaviors (P6-T6)
        usCorpAdaptation(corp, newCountryData);
        chinaCorpAdaptation(corp, newCountryData);
        euCorpAdaptation(corp, newCountryData);
      });

      // Update corporations state
      setCorporations(updatedCorps);
      setGlobalLedger(newLedger);

      // Analyze game theory dynamics (P6-T4)
      const gameTheory = analyzeGameTheory(updatedCorps);
      setGameTheoryState(gameTheory);

      // Calculate total AI companies from corporations
      const totalAiCompanies = updatedCorps.length;

      const newState: SimulationState = {
        month: nextMonth,
        globalFund: newLedger.totalFunds,
        averageWellbeing: totalWellbeing / Object.keys(newCountryData).length,
        totalAiCompanies,
        countryData: newCountryData,
        shadowCountryData: newShadowData,
        globalDisplacementGap: totalDisplacementGap,
        corruptionLeakage: 0, // No corruption with direct-to-wallet
        countriesInCrisis
      };

      setHistory(h => [...h.filter(p => p.month < nextMonth), { month: nextMonth, state: newState }]);
      return newState;
    });
  }, [model, corporations, calculateAiRevenue, distributeGlobal, distributeCustomerWeighted, distributeHqLocal]);

  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        stepSimulation();
        // Also step comparison simulation if in comparison mode (P7-T5)
        if (comparisonMode) {
          // Comparison simulation runs in parallel with same month progression
          // NOTE: For full implementation, would need to extract stepSimulation into reusable function
          // For now, comparison state is set once and shows static snapshot at month 0
        }
      }, 1000 / speed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, speed, stepSimulation, comparisonMode]);

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

  // Unified entity selection handlers
  const handleSelectCorporation = (id: string) => {
    setSelectedEntity({ type: 'corporation', id });
  };

  const handleSelectCountry = (id: string) => {
    setSelectedEntity({ type: 'country', id });
  };

  const handleDeselectEntity = () => {
    setSelectedEntity(null);
  };

  // Multi-select handlers
  const handleToggleCorpSelection = (id: string) => {
    setSelectedCorpIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllCorps = (filter: 'us' | 'eu' | 'all' | 'clear') => {
    if (filter === 'clear') {
      setSelectedCorpIds(new Set());
      return;
    }

    const filtered = corporations.filter(corp => {
      if (filter === 'us') return corp.headquartersCountry === 'USA';
      if (filter === 'eu') return ['Germany', 'France', 'Netherlands', 'Ireland'].includes(corp.headquartersCountry);
      return true;
    });

    setSelectedCorpIds(new Set(filtered.map(c => c.id)));
  };

  const handleBulkUpdateContribution = (newRate: number) => {
    setCorporations(prev => prev.map(corp =>
      selectedCorpIds.has(corp.id)
        ? { ...corp, contributionRate: newRate }
        : corp
    ));
  };

  // ESC key handler for deselection
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleDeselectEntity();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const triggerSummarize = async () => {
    if (history.length === 0) {
      alert("Please run the simulation (press Play) to generate data before creating a summary.");
      return;
    }
    if (summary && !isSummarizing) return;
    setIsSummarizing(true);
    const res = await getSimulationSummary(model, history);
    setSummary(res || "Summary failed.");
    setIsSummarizing(false);
  };

  const triggerRedTeam = async () => {
    if (history.length === 0) {
      alert("Please run the simulation (press Play) to generate data before running a Red Team audit.");
      return;
    }
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

      // Global displacement gap
      data['DisplacementGap_Global'] = point.state.globalDisplacementGap / 1e9; // Convert to billions

      Object.keys(point.state.countryData).forEach(id => {
        data[`Wellbeing_${id}`] = point.state.countryData[id].wellbeing;
        data[`Adoption_${id}`] = point.state.countryData[id].aiAdoption * 100;
        data[`DisplacementGap_${id}`] = (point.state.countryData[id].displacementGap || 0) / 1000; // Convert to thousands
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

  // ============================================================================
  // AUTO-SAVE TO LOCALSTORAGE (P6-T8)
  // ============================================================================
  // Automatically save simulation state to localStorage every 5 minutes
  // Provides recovery in case of browser crash or accidental close
  // ============================================================================

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const autoSave: SavedState = {
          version: "2.0",
          timestamp: Date.now(),
          month: state.month,
          corporations,
          countryData: state.countryData,
          globalLedger,
          gameTheoryState,
          model,
          history
        };
        localStorage.setItem('ubi-sim-autosave', JSON.stringify(autoSave));
        console.log(`Auto-saved at ${new Date().toLocaleTimeString()}`);
      } catch (err) {
        console.error("Auto-save failed:", err);
        // Clear old autosave if storage is full
        if (err instanceof DOMException && err.name === 'QuotaExceededError') {
          localStorage.removeItem('ubi-sim-autosave');
        }
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [state, corporations, globalLedger, gameTheoryState, model, history]);

  // Load autosave on mount if available
  useEffect(() => {
    try {
      const autoSave = localStorage.getItem('ubi-sim-autosave');
      if (autoSave && state.month === 0) {
        // Only offer to load autosave if we're at the initial state
        const shouldLoad = window.confirm(
          'An auto-saved simulation was found. Would you like to restore it?'
        );
        if (shouldLoad) {
          const saved = JSON.parse(autoSave) as SavedState;
          setState(prev => ({
            ...prev,
            month: saved.month,
            countryData: saved.countryData,
            globalFund: saved.globalLedger.totalFunds,
            averageWellbeing: Object.values(saved.countryData).reduce((sum, c) => sum + c.wellbeing, 0) / Object.values(saved.countryData).length,
            totalAiCompanies: saved.corporations.length,
            shadowCountryData: saved.countryData,
            globalDisplacementGap: prev.globalDisplacementGap,
            corruptionLeakage: 0,
            countriesInCrisis: prev.countriesInCrisis
          }));
          setCorporations(saved.corporations);
          setGlobalLedger(saved.globalLedger);
          setGameTheoryState(saved.gameTheoryState);
          setModel(saved.model);
          setHistory(saved.history || []);
          console.log('Auto-save restored successfully');
        }
      }
    } catch (err) {
      console.error("Failed to load auto-save:", err);
      localStorage.removeItem('ubi-sim-autosave');
    }
  }, []); // Only run on mount

  return (
    <div className={`flex flex-col h-[100dvh] overflow-hidden transition-colors duration-300 ${theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
      {/* Tour Overlay */}
      {tourStep !== null && (
          <TourOverlay
            step={tourStep}
            onNext={() => {
                if (tourStep < 10) {
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
            <p className="text-[8px] lg:text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1 font-mono">Abundance Cycle v0.14</p>
          </div>
        </div>

        <nav className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg lg:rounded-xl border border-slate-200 dark:border-slate-700">
          {(['map', 'charts', 'corporations'] as const).map(tab => (
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

          {/* Compare Mode Toggle (P7-T5) */}
          <button
             onClick={() => setComparisonMode(!comparisonMode)}
             className={`px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${comparisonMode ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'}`}
             title="Compare two scenarios side-by-side"
          >
            Compare
          </button>

          <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1"></div>

          {/* Save/Load Buttons */}
          <button
             onClick={saveToFile}
             className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
             title="Save Scenario to File"
          >
            <Download size={16} />
          </button>

          <label
             className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
             title="Load Scenario from File"
          >
            <Upload size={16} />
            <input
              type="file"
              accept=".json"
              onChange={loadFromFile}
              className="hidden"
            />
          </label>

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
                <h2 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  Scenario Presets
                  <InfoTooltip text="Pre-configured scenarios demonstrating different game theory outcomes: cooperation, defection, protectionism, etc." />
                </h2>
                <div className="space-y-2">
                {SCENARIO_PRESETS.map(scenario => (
                    <div key={scenario.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/50">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">{scenario.name}</h3>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">{scenario.description}</p>
                      <button
                        onClick={() => {
                          applyScenario(scenario.id);
                          if(window.innerWidth < 1024) setIsSidebarOpen(false);
                        }}
                        className="w-full px-3 py-2 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-sm hover:shadow-md"
                      >
                        Load Scenario
                      </button>
                    </div>
                ))}
                </div>
            </div>

            {/* Comparison Scenario Selector (P7-T5) */}
            {comparisonMode && (
              <div className="border-2 border-purple-500 dark:border-purple-600 rounded-xl p-4 bg-purple-50 dark:bg-purple-900/20">
                <h2 className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                  Comparison Scenario B
                  <InfoTooltip text="Select a different scenario to compare against your current setup (Scenario A)." />
                </h2>
                <div className="space-y-2">
                  {SCENARIO_PRESETS.map(scenario => (
                    <button
                      key={scenario.id}
                      onClick={() => setComparisonScenarioId(scenario.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                        comparisonScenarioId === scenario.id
                          ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                          : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-purple-400 dark:hover:border-purple-500'
                      }`}
                    >
                      <div className="font-bold">{scenario.name}</div>
                      <div className="text-[9px] opacity-75 mt-1">{scenario.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
                <h2 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">Core Parameters</h2>
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

            <div>
                <h2 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">Economic Constants</h2>
                <div className="space-y-6">
                {[
                    { label: 'Displacement Rate', key: 'displacementRate', unit: '%', step: 0.05, min: 0.5, max: 0.95, multiplier: 100, tooltip: 'How much labor income is displaced at 100% AI adoption.' },
                ].map(p => (
                    <div key={p.key}>
                    <div className="flex justify-between text-[10px] mb-2 font-mono text-slate-500 dark:text-slate-400">
                      <span className="flex items-center">{p.label}<InfoTooltip text={p.tooltip} /></span>
                      <span className="text-slate-900 dark:text-white">{((model as any)[p.key] * p.multiplier).toFixed(0)}{p.unit}</span>
                    </div>
                    <input type="range" min={p.min} max={p.max} step={p.step} value={(model as any)[p.key]} onChange={(e) => setModel({ ...model, [p.key]: parseFloat(e.target.value) })} className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600" />
                    </div>
                ))}
                </div>
            </div>

            <div>
                <h2 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">Corporation Policy</h2>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-[10px] mb-2 font-mono text-slate-500 dark:text-slate-400">
                      <span className="flex items-center">Default Corp Policy<InfoTooltip text="Initial policy stance for all corporations at simulation start." /></span>
                    </div>
                    <select
                      value={model.defaultCorpPolicy}
                      onChange={(e) => setModel({ ...model, defaultCorpPolicy: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="free-market">Free Market (Moderate, Adaptive)</option>
                      <option value="selfish-start">Selfish Start (Min UBI, Adaptive)</option>
                      <option value="altruistic-start">Altruistic Start (Generous)</option>
                      <option value="mixed-reality">Mixed Reality (Realistic)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] mb-2 font-mono text-slate-500 dark:text-slate-400">
                      <span className="flex items-center">Market Pressure<InfoTooltip text="How strongly customer demand affects corporate contribution decisions. Higher = corporations respond more to customer wellbeing." /></span>
                      <span className="text-slate-900 dark:text-white">{(model.marketPressure * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={model.marketPressure}
                      onChange={(e) => setModel({ ...model, marketPressure: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                  </div>
                </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 text-blue-600 dark:text-blue-400">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-[10px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest mb-2">Corporation-Centric Model</h3>
                  <p className="text-[10px] text-blue-800 dark:text-blue-400 leading-relaxed">
                    In this model, UBI contributions are made voluntarily by AI corporations based on their self-interest (customer preservation) and reputation concerns. Nation states cannot mandate participation.
                  </p>
                </div>
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
              {/* Compact Stats Row - Primary */}
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

              {/* Secondary Stats Row - Crisis Indicators */}
              <div className="grid grid-cols-3 gap-2 shrink-0">
                <div className={`bg-white dark:bg-slate-900 border px-3 py-2 rounded-lg flex justify-between items-center shadow-sm ${state.countriesInCrisis > 0 ? 'border-rose-400 dark:border-rose-600' : 'border-slate-200 dark:border-slate-800'}`}>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest flex items-center">
                    In Crisis
                    <InfoTooltip text="Countries where displacement gap exceeds 30% of monthly wage. UBI not keeping pace with job losses." />
                  </div>
                  <div className={`text-sm font-bold font-mono ${state.countriesInCrisis > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                    {state.countriesInCrisis}/{Object.keys(state.countryData).length}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-lg flex justify-between items-center shadow-sm">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest flex items-center">
                    Leakage
                    <InfoTooltip text="Monthly corruption leakage - tax dollars lost to corrupt governments." />
                  </div>
                  <div className="text-sm font-bold font-mono text-orange-600 dark:text-orange-400">
                    {state.corruptionLeakage > 1e9 ? `$${(state.corruptionLeakage / 1e9).toFixed(1)}B` : state.corruptionLeakage > 1e6 ? `$${(state.corruptionLeakage / 1e6).toFixed(0)}M` : '$0'}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-lg flex justify-between items-center shadow-sm">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest flex items-center">
                    Gap
                    <InfoTooltip text="Global displacement gap - aggregate lost wages minus UBI received across all countries." />
                  </div>
                  <div className={`text-sm font-bold font-mono ${state.globalDisplacementGap > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {state.globalDisplacementGap > 1e12 ? `$${(state.globalDisplacementGap / 1e12).toFixed(1)}T` : state.globalDisplacementGap > 1e9 ? `$${(state.globalDisplacementGap / 1e9).toFixed(0)}B` : '$0'}
                  </div>
                </div>
              </div>

              {/* Game Theory Indicator - P6-T4 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0">
                <div className={`bg-white dark:bg-slate-900 border px-3 py-2 rounded-lg flex justify-between items-center shadow-sm ${
                  gameTheoryState.isInPrisonersDilemma
                    ? 'border-amber-400 dark:border-amber-600'
                    : gameTheoryState.virtuousCycleStrength > 0.5
                      ? 'border-emerald-400 dark:border-emerald-600'
                      : 'border-slate-200 dark:border-slate-800'
                }`}>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest flex items-center">
                    Cooperation
                    <InfoTooltip text="Generous corporations vs selfish corporations. Green = virtuous cycle, Yellow = prisoner's dilemma tension." />
                  </div>
                  <div className={`text-sm font-bold font-mono ${
                    gameTheoryState.cooperationCount > gameTheoryState.defectionCount
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : gameTheoryState.cooperationCount < gameTheoryState.defectionCount
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {gameTheoryState.cooperationCount}/{gameTheoryState.defectionCount}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-lg flex justify-between items-center shadow-sm">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest flex items-center">
                    Avg Rate
                    <InfoTooltip text="Average UBI contribution rate across all corporations. Higher is more generous." />
                  </div>
                  <div className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
                    {(gameTheoryState.avgContributionRate * 100).toFixed(1)}%
                  </div>
                </div>
                <div className={`bg-white dark:bg-slate-900 border px-3 py-2 rounded-lg flex justify-between items-center shadow-sm ${
                  gameTheoryState.raceToBottomRisk > 0.5 ? 'border-rose-400 dark:border-rose-600' : 'border-slate-200 dark:border-slate-800'
                }`}>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest flex items-center">
                    Race Risk
                    <InfoTooltip text="Risk of mass defection to selfishness. High when >40% of corps are selfish." />
                  </div>
                  <div className={`text-sm font-bold font-mono ${
                    gameTheoryState.raceToBottomRisk > 0.5 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                  }`}>
                    {(gameTheoryState.raceToBottomRisk * 100).toFixed(0)}%
                  </div>
                </div>
                <div className={`bg-white dark:bg-slate-900 border px-3 py-2 rounded-lg flex justify-between items-center shadow-sm ${
                  gameTheoryState.virtuousCycleStrength > 0.5 ? 'border-emerald-400 dark:border-emerald-600' : 'border-slate-200 dark:border-slate-800'
                }`}>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest flex items-center">
                    Virtuous
                    <InfoTooltip text="Strength of virtuous cooperation cycle. High when >60% of corps are generous." />
                  </div>
                  <div className={`text-sm font-bold font-mono ${
                    gameTheoryState.virtuousCycleStrength > 0.5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                  }`}>
                    {(gameTheoryState.virtuousCycleStrength * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Prisoner's Dilemma Warning */}
              {gameTheoryState.isInPrisonersDilemma && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-400 dark:border-amber-600 px-4 py-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="text-amber-600 dark:text-amber-400 font-bold text-xs uppercase">Warning: Prisoner's Dilemma Detected</div>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    High defection pressure with low cooperation. Corporations may be caught in a race to the bottom.
                  </p>
                </div>
              )}

              <div className="flex-1 min-h-[300px] relative">
                {comparisonMode ? (
                  /* Comparison Mode - Split View (P7-T5) */
                  <div className="h-full grid grid-cols-2 gap-4">
                    {/* Left Side - Main Scenario */}
                    <div className="flex flex-col h-full">
                      <div className="mb-2 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2 rounded-lg">
                        <div className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest">Scenario A: Current</div>
                        <div className="text-xs text-blue-700 dark:text-blue-400">Wellbeing: {state.averageWellbeing.toFixed(1)}</div>
                      </div>
                      <div className="flex-1 relative">
                        <WorldMap
                          countryData={state.countryData}
                          onCountryClick={handleCountryInvestment}
                          onCountrySelect={handleSelectCountry}
                          viewMode={viewMode}
                          selectedCountryId={selectedEntity?.type === 'country' ? selectedEntity.id : null}
                          corporations={corporations}
                          selectedCorpId={selectedEntity?.type === 'corporation' ? selectedEntity.id : null}
                          selectedArchetype={selectedArchetype}
                        />
                      </div>
                    </div>
                    {/* Right Side - Comparison Scenario */}
                    <div className="flex flex-col h-full">
                      <div className="mb-2 flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 px-3 py-2 rounded-lg">
                        <div className="text-xs font-bold text-purple-900 dark:text-purple-300 uppercase tracking-widest">
                          Scenario B: {SCENARIO_PRESETS.find(s => s.id === comparisonScenarioId)?.name || 'Alternative'} (Initial State)
                        </div>
                        <div className="text-xs text-purple-700 dark:text-purple-400">Month 0 Baseline</div>
                      </div>
                      <div className="flex-1 relative">
                        <WorldMap
                          countryData={comparisonState.countryData}
                          onCountryClick={() => {}} // No investment in comparison view
                          onCountrySelect={() => {}} // No selection in comparison view
                          viewMode={viewMode}
                          selectedCountryId={null}
                          corporations={comparisonCorporations}
                          selectedCorpId={null}
                          selectedArchetype={selectedArchetype}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Normal Mode - Single View */
                  <WorldMap
                    countryData={state.countryData}
                    onCountryClick={handleCountryInvestment}
                    onCountrySelect={handleSelectCountry}
                    viewMode={viewMode}
                    selectedCountryId={selectedEntity?.type === 'country' ? selectedEntity.id : null}
                    corporations={corporations}
                    selectedCorpId={selectedEntity?.type === 'corporation' ? selectedEntity.id : null}
                    selectedArchetype={selectedArchetype}
                  />
                )}

                {/* How To Start Hint Overlay */}
                {!comparisonMode && showStartHint && !isPlaying && (
                    <div className="absolute top-4 right-4 z-20 w-48 bg-blue-600/95 text-white p-4 rounded-xl shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-700">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <Lightbulb size={16} className="text-blue-100" />
                                <h3 className="font-bold text-xs uppercase tracking-widest">Start Here</h3>
                            </div>
                            <button onClick={() => setShowStartHint(false)} className="text-blue-200 hover:text-white"><X size={14}/></button>
                        </div>
                        <div>
                            <p className="text-[10px] leading-relaxed opacity-90 mb-3">Press <span className="font-bold text-white bg-white/20 px-1 rounded">PLAY</span> below to begin the simulation. Observe how the gradient UBI stabilizes global wellbeing.</p>
                            <button 
                                onClick={() => setTourStep(0)}
                                className="w-full py-1.5 bg-white text-blue-600 rounded-lg text-[10px] font-bold uppercase hover:bg-blue-50 transition-colors"
                            >
                                Take a Tour
                            </button>
                        </div>
                    </div>
                )}
              </div>

              {/* Archetype Filter */}
              <div className="flex justify-center shrink-0 mt-2">
                <div className="flex flex-wrap gap-1.5 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm max-w-xl">
                  <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest w-full mb-1">Filter by Archetype:</div>
                  <button
                    onClick={() => setSelectedArchetype(null)}
                    className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${
                      selectedArchetype === null ? 'bg-slate-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSelectedArchetype('rich-democracy')}
                    className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${
                      selectedArchetype === 'rich-democracy' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Rich Democracy
                  </button>
                  <button
                    onClick={() => setSelectedArchetype('middle-stable')}
                    className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${
                      selectedArchetype === 'middle-stable' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Middle Stable
                  </button>
                  <button
                    onClick={() => setSelectedArchetype('developing-fragile')}
                    className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${
                      selectedArchetype === 'developing-fragile' ? 'bg-amber-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Developing Fragile
                  </button>
                  <button
                    onClick={() => setSelectedArchetype('authoritarian')}
                    className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${
                      selectedArchetype === 'authoritarian' ? 'bg-purple-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Authoritarian
                  </button>
                  <button
                    onClick={() => setSelectedArchetype('failed-state')}
                    className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${
                      selectedArchetype === 'failed-state' ? 'bg-rose-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Failed State
                  </button>
                </div>
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
              <div className="flex gap-2 w-full justify-end" id="ai-tools">
                    <button 
                    onClick={() => { setActiveTab('analysis'); triggerSummarize(); }}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-xl transition-all active:scale-95"
                    >
                        <Sparkles size={16} />
                        <span>Summarize</span>
                    </button>

                    <button 
                        onClick={() => { setActiveTab('analysis'); triggerRedTeam(); }}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-xl transition-all active:scale-95"
                    >
                        <BrainCircuit size={16} />
                        <span>Red Team</span>
                    </button>
              </div>
              
              {/* Charts Container with Conditional Overlay */}
              <div className="relative flex flex-col gap-6 lg:gap-8">
                  {history.length === 0 && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center backdrop-blur-sm bg-white/30 dark:bg-slate-900/30 rounded-[2rem]">
                          <div className="bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl shadow-2xl max-w-sm text-center animate-in fade-in zoom-in duration-300">
                              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <TrendingUp size={32} />
                              </div>
                              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Waiting for Data</h3>
                              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">Results will be graphed in real-time as soon as the simulation starts. Press <span className="font-bold text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs mx-1">PLAY</span> to begin.</p>
                          </div>
                      </div>
                  )}

                  <div className="h-[400px] shrink-0">
                    <MotionChart 
                        history={history.slice(0, state.month + 1)} // Slice for motion
                        maxMonth={Math.max(...history.map(h => h.month), 10)}
                        selectedCountries={selectedCountries} 
                        allCountries={['Global', ...INITIAL_COUNTRIES.map(c => c.id)].map(id => ({ id, name: id }))}
                        onToggleCountry={(id) => setSelectedCountries(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                        theme={theme}
                    />
                  </div>

                  <div className="h-[300px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                     <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Database size={14} /> Global Fund Accumulation ($B)
                     </h3>
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData.slice(0, state.month + 1)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorFund" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tick={{fontSize: 10, fill: theme === 'light' ? '#64748b' : '#94a3b8'}} axisLine={false} tickLine={false} />
                            <YAxis tick={{fontSize: 10, fill: theme === 'light' ? '#64748b' : '#94a3b8'}} axisLine={false} tickLine={false} />
                            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e2e8f0' : '#1e293b'} vertical={false} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#0f172a', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }}
                                itemStyle={{ color: theme === 'light' ? '#000' : '#fff' }}
                            />
                            <Area type="monotone" dataKey="fund" stroke="#f59e0b" fillOpacity={1} fill="url(#colorFund)" strokeWidth={2} name="Total Fund ($B)" isAnimationActive={false} />
                        </AreaChart>
                     </ResponsiveContainer>
                  </div>

                  <div className="h-[350px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                     <div className="flex items-start justify-between mb-4">
                       <div>
                         <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <TrendingDown size={14} /> Displacement Gap by Country
                         </h3>
                         <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                           Lost wages minus UBI received (k$ per capita/month)
                         </p>
                       </div>
                       <div className="flex items-center gap-2 px-2 py-1 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg">
                         <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>
                         <span className="text-[9px] font-bold text-rose-700 dark:text-rose-400 uppercase">
                           {state.countriesInCrisis} in crisis
                         </span>
                       </div>
                     </div>
                     <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData.slice(0, state.month + 1)} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e2e8f0' : '#1e293b'} vertical={false} />
                            <XAxis
                              dataKey="date"
                              tick={{fontSize: 10, fill: theme === 'light' ? '#64748b' : '#94a3b8'}}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{fontSize: 10, fill: theme === 'light' ? '#64748b' : '#94a3b8'}}
                              axisLine={false}
                              tickLine={false}
                              label={{ value: 'Displacement Gap (k$)', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: theme === 'light' ? '#64748b' : '#94a3b8' } }}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#0f172a', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }}
                                itemStyle={{ color: theme === 'light' ? '#000' : '#fff' }}
                                formatter={(value: any) => [`$${value.toFixed(2)}k`, '']}
                            />
                            <Legend
                              wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                              iconSize={8}
                            />
                            {selectedCountries.map((id, idx) => {
                              const hue = (idx * 137) % 360;
                              return (
                                <Line
                                  key={id}
                                  type="monotone"
                                  dataKey={`DisplacementGap_${id}`}
                                  stroke={`hsl(${hue}, 70%, 60%)`}
                                  strokeWidth={2}
                                  dot={false}
                                  name={id}
                                  isAnimationActive={false}
                                />
                              );
                            })}
                        </LineChart>
                     </ResponsiveContainer>
                     <div className="mt-2 flex items-center gap-2 text-[9px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg">
                       <Info size={12} />
                       <span>
                         When displacement gap {'>'} 30% of monthly wage, countries enter crisis mode (wellbeing penalty applied).
                         Positive values = suffering, zero = full UBI coverage.
                       </span>
                     </div>
                  </div>
              </div>
            </div>
          )}

          {activeTab === 'corporations' && (
            <div className="h-full overflow-y-auto">
              <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Game Theory Visualization Section */}
                <GameTheoryVisualization
                  gameTheoryState={gameTheoryState}
                  corporations={corporations}
                />

                {/* Corporation List Section */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Corporation Directory</h2>
                  <CorporationList
                    corporations={corporations}
                    selectedCorpId={selectedEntity?.type === 'corporation' ? selectedEntity.id : null}
                    onSelectCorp={handleSelectCorporation}
                    selectedCorpIds={selectedCorpIds}
                    onToggleCorpSelection={handleToggleCorpSelection}
                    onSelectAllCorps={handleSelectAllCorps}
                    onBulkUpdateContribution={handleBulkUpdateContribution}
                  />
                </div>
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

          {activeTab === 'overview' && (
            <div className="max-w-6xl mx-auto py-8 lg:py-12 flex flex-col items-center justify-center h-full gap-8">
              <div className="text-center space-y-3">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">The Abundance Cycle</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-2xl text-sm">
                  Watch how the system creates a positive feedback loop. Corps share surplus → UBI stabilizes citizens →
                  citizens spend → corps grow larger. The pie expands for everyone.
                </p>
              </div>

              {/* SVG Animation Canvas */}
              <div className="relative w-full max-w-4xl aspect-[4/3] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                <svg viewBox="0 0 800 600" className="w-full h-full">
                  <defs>
                    {/* Gradients */}
                    <linearGradient id="corpsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.9"/>
                      <stop offset="100%" stopColor="#1d4ed8" stopOpacity="1"/>
                    </linearGradient>
                    <linearGradient id="taxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.9"/>
                      <stop offset="100%" stopColor="#059669" stopOpacity="1"/>
                    </linearGradient>
                    <linearGradient id="ledgerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9"/>
                      <stop offset="100%" stopColor="#d97706" stopOpacity="1"/>
                    </linearGradient>
                    <linearGradient id="peopleThrivingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.9"/>
                      <stop offset="100%" stopColor="#059669" stopOpacity="1"/>
                    </linearGradient>
                    <linearGradient id="peopleScarcityGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9"/>
                      <stop offset="100%" stopColor="#dc2626" stopOpacity="1"/>
                    </linearGradient>

                    {/* Arrow Marker */}
                    <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                      <polygon points="0 0, 10 3, 0 6" fill={theme === 'light' ? '#64748b' : '#94a3b8'} />
                    </marker>
                  </defs>

                  {/* Connection Paths */}
                  {overviewCycleData.showTendril1 && (
                    <path
                      d={getSnakePath(overviewCycleData.vA, overviewCycleData.midAB, overviewCycleData.isSnapped1)}
                      stroke={theme === 'light' ? '#10b981' : '#10b981'}
                      strokeWidth={overviewCycleData.isSnapped1 ? 4 : 3}
                      fill="none"
                      strokeDasharray={overviewCycleData.isSnapped1 ? "0" : "8,4"}
                      opacity={Math.min(1, overviewCycleData.prog1 * 2)}
                      strokeDashoffset={overviewCycleData.isSnapped1 ? 0 : -(overviewStep * 0.5)}
                      markerEnd={overviewCycleData.isSnapped1 ? "url(#arrowhead)" : ""}
                    />
                  )}

                  {overviewCycleData.showTendril2 && (
                    <path
                      d={getSnakePath(overviewCycleData.midAB, overviewCycleData.midBC, overviewCycleData.isSnapped2)}
                      stroke={theme === 'light' ? '#f59e0b' : '#f59e0b'}
                      strokeWidth={overviewCycleData.isSnapped2 ? 4 : 3}
                      fill="none"
                      strokeDasharray={overviewCycleData.isSnapped2 ? "0" : "8,4"}
                      opacity={Math.min(1, overviewCycleData.prog2 * 2)}
                      strokeDashoffset={overviewCycleData.isSnapped2 ? 0 : -(overviewStep * 0.5)}
                      markerEnd={overviewCycleData.isSnapped2 ? "url(#arrowhead)" : ""}
                    />
                  )}

                  {overviewCycleData.showTendril3 && (
                    <path
                      d={getSnakePath(overviewCycleData.midBC, overviewCycleData.midCA, overviewCycleData.isSnapped3)}
                      stroke={theme === 'light' ? '#3b82f6' : '#60a5fa'}
                      strokeWidth={overviewCycleData.isSnapped3 ? (4 + overviewCycleData.prog3 * 4) : 3}
                      fill="none"
                      strokeDasharray={overviewCycleData.isSnapped3 ? "0" : "8,4"}
                      opacity={Math.min(1, overviewCycleData.prog3 * 2)}
                      strokeDashoffset={overviewCycleData.isSnapped3 ? 0 : -(overviewStep * 0.5)}
                      markerEnd={overviewCycleData.isSnapped3 ? "url(#arrowhead)" : ""}
                    >
                      {overviewCycleData.isSnapped3 && (
                        <animate
                          attributeName="stroke-width"
                          values={`${4 + overviewCycleData.prog3 * 4};${6 + overviewCycleData.prog3 * 6};${4 + overviewCycleData.prog3 * 4}`}
                          dur="1.5s"
                          repeatCount="indefinite"
                        />
                      )}
                    </path>
                  )}

                  {/* Flowing Particles */}
                  {overviewCycleData.isSnapped1 && [0, 0.25, 0.5, 0.75].map((offset, i) => {
                    const phase = ((overviewStep * overviewCycleData.particleSpeed * 0.003) + offset) % 1;
                    const path1 = getSnakePath(overviewCycleData.vA, overviewCycleData.midAB, true);
                    return (
                      <circle key={`p1-${i}`} r="4" fill="#10b981">
                        <animateMotion dur={`${2 / overviewCycleData.particleSpeed}s`} repeatCount="indefinite" begin={`${offset * 2}s`}>
                          <mpath href={`#path1-${i}`} />
                        </animateMotion>
                        <path id={`path1-${i}`} d={path1} style={{ display: 'none' }} />
                      </circle>
                    );
                  })}

                  {overviewCycleData.isSnapped2 && [0, 0.33, 0.66].map((offset, i) => (
                    <circle key={`p2-${i}`} r="4" fill="#f59e0b">
                      <animateMotion dur={`${2 / overviewCycleData.particleSpeed}s`} repeatCount="indefinite" begin={`${offset * 2}s`}>
                        <mpath href="#path2" />
                      </animateMotion>
                    </circle>
                  ))}
                  <path id="path2" d={getSnakePath(overviewCycleData.midAB, overviewCycleData.midBC, true)} style={{ display: 'none' }} />

                  {overviewCycleData.isSnapped3 && [0, 0.2, 0.4, 0.6, 0.8].map((offset, i) => (
                    <circle key={`p3-${i}`} r="4" fill="#3b82f6">
                      <animateMotion dur={`${2 / overviewCycleData.particleSpeed}s`} repeatCount="indefinite" begin={`${offset * 2}s`}>
                        <mpath href="#path3" />
                      </animateMotion>
                    </circle>
                  ))}
                  <path id="path3" d={getSnakePath(overviewCycleData.midBC, overviewCycleData.midCA, true)} style={{ display: 'none' }} />

                  {/* Node A: Corps (Top) */}
                  {overviewCycleData.showNodeA && (
                    <g>
                      {/* Corps Pie Chart */}
                      {overviewCycleData.corpWedges.map((wedge, i) => {
                        const total = overviewCycleData.corpWedges.reduce((sum, w) => sum + w.value, 0);
                        const startAngle = overviewCycleData.corpWedges.slice(0, i).reduce((sum, w) => sum + w.value, 0) / total * 360 - 90;
                        const endAngle = startAngle + (wedge.value / total * 360);
                        const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
                        const x1 = overviewCycleData.vA.x + (45 * overviewCycleData.scale) * Math.cos(startAngle * Math.PI / 180);
                        const y1 = overviewCycleData.vA.y + (45 * overviewCycleData.scale) * Math.sin(startAngle * Math.PI / 180);
                        const x2 = overviewCycleData.vA.x + (45 * overviewCycleData.scale) * Math.cos(endAngle * Math.PI / 180);
                        const y2 = overviewCycleData.vA.y + (45 * overviewCycleData.scale) * Math.sin(endAngle * Math.PI / 180);

                        return (
                          <path
                            key={i}
                            d={`M ${overviewCycleData.vA.x} ${overviewCycleData.vA.y} L ${x1} ${y1} A ${45 * overviewCycleData.scale} ${45 * overviewCycleData.scale} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                            fill={wedge.color}
                            stroke={theme === 'light' ? '#fff' : '#0f172a'}
                            strokeWidth="2"
                          />
                        );
                      })}
                      <text x={overviewCycleData.vA.x} y={overviewCycleData.vA.y - 70 * overviewCycleData.scale} textAnchor="middle" className="text-lg font-bold fill-slate-900 dark:fill-white">Corps</text>
                      <text x={overviewCycleData.vA.x} y={overviewCycleData.vA.y - 52 * overviewCycleData.scale} textAnchor="middle" className="text-xs fill-slate-500 dark:fill-slate-400">Generate Surplus</text>
                    </g>
                  )}

                  {/* Node B: Ledger (Bottom Right) */}
                  {overviewCycleData.showNodeB && (
                    <g>
                      <circle cx={overviewCycleData.midAB.x} cy={overviewCycleData.midAB.y} r={45 * overviewCycleData.scale} fill="url(#ledgerGrad)" stroke={theme === 'light' ? '#fff' : '#0f172a'} strokeWidth="3" />
                      <text x={overviewCycleData.midAB.x} y={overviewCycleData.midAB.y + 70 * overviewCycleData.scale} textAnchor="middle" className="text-lg font-bold fill-slate-900 dark:fill-white">Ledger</text>
                      <text x={overviewCycleData.midAB.x} y={overviewCycleData.midAB.y + 88 * overviewCycleData.scale} textAnchor="middle" className="text-xs fill-slate-500 dark:fill-slate-400">Global Fund</text>
                    </g>
                  )}

                  {/* Node C: People (Bottom Left) */}
                  {overviewCycleData.showNodeC && (
                    <g>
                      {/* People Pie Chart */}
                      {overviewCycleData.humanWedges.map((wedge, i) => {
                        const total = overviewCycleData.humanWedges.reduce((sum, w) => sum + w.value, 0);
                        const startAngle = overviewCycleData.humanWedges.slice(0, i).reduce((sum, w) => sum + w.value, 0) / total * 360 - 90;
                        const endAngle = startAngle + (wedge.value / total * 360);
                        const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
                        const x1 = overviewCycleData.midBC.x + (45 * overviewCycleData.scale) * Math.cos(startAngle * Math.PI / 180);
                        const y1 = overviewCycleData.midBC.y + (45 * overviewCycleData.scale) * Math.sin(startAngle * Math.PI / 180);
                        const x2 = overviewCycleData.midBC.x + (45 * overviewCycleData.scale) * Math.cos(endAngle * Math.PI / 180);
                        const y2 = overviewCycleData.midBC.y + (45 * overviewCycleData.scale) * Math.sin(endAngle * Math.PI / 180);

                        return (
                          <path
                            key={i}
                            d={`M ${overviewCycleData.midBC.x} ${overviewCycleData.midBC.y} L ${x1} ${y1} A ${45 * overviewCycleData.scale} ${45 * overviewCycleData.scale} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                            fill={wedge.color}
                            stroke={theme === 'light' ? '#fff' : '#0f172a'}
                            strokeWidth="2"
                          />
                        );
                      })}
                      <text x={overviewCycleData.midBC.x} y={overviewCycleData.midBC.y + 70 * overviewCycleData.scale} textAnchor="middle" className="text-lg font-bold fill-slate-900 dark:fill-white">People</text>
                      <text x={overviewCycleData.midBC.x} y={overviewCycleData.midBC.y + 88 * overviewCycleData.scale} textAnchor="middle" className="text-xs fill-slate-500 dark:fill-slate-400">Citizens</text>
                    </g>
                  )}
                </svg>

                {/* Legend */}
                <div className="absolute bottom-6 left-6 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-600"></div>
                    <span className="text-slate-700 dark:text-slate-300">Tax Flow (Corps → Fund)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-600"></div>
                    <span className="text-slate-700 dark:text-slate-300">UBI Distribution (Fund → People)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                    <span className="text-slate-700 dark:text-slate-300">Consumer Spending (People → Corps)</span>
                  </div>
                </div>

                {/* Progress Indicator */}
                <div className="absolute top-6 right-6 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-mono text-slate-700 dark:text-slate-300">
                  {overviewCycleData.step < 600 ? 'Step 1: Tax Collection' :
                   overviewCycleData.step < 1100 ? 'Step 2: UBI Distribution' :
                   overviewCycleData.step < 1600 ? 'Step 3: Economic Loop' :
                   overviewCycleData.step < 3000 ? 'Step 4: Growth Phase' : 'Restarting...'}
                </div>
              </div>

              {/* Key Insight */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6 max-w-3xl">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shrink-0">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-2">The Key Insight</h3>
                    <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                      Even though corporations contribute a percentage to the fund, they grow larger overall because citizens
                      have purchasing power. The system creates abundance rather than scarcity. As UBI flows to people,
                      consumer demand increases, driving corporate revenue growth that exceeds the tax contribution.
                      Everyone's slice of the pie grows simultaneously.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'equations' && (
            <div className="max-w-4xl mx-auto py-8 lg:py-12 space-y-8">
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Model Equations</h2>
                <p className="text-slate-500 dark:text-slate-400">
                  {equationViewMode === 'simple'
                    ? 'Core mathematical relationships driving the simulation'
                    : 'Complete equation set for peer review and verification'}
                </p>
              </div>

              {/* Toggle Button */}
              <div className="flex justify-center">
                <div className="flex p-0.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                  <button
                    onClick={() => setEquationViewMode('simple')}
                    className={`px-4 py-2 rounded-md text-xs font-bold uppercase transition-all ${equationViewMode === 'simple' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}
                  >
                    Simple View
                  </button>
                  <button
                    onClick={() => setEquationViewMode('detailed')}
                    className={`px-4 py-2 rounded-md text-xs font-bold uppercase transition-all ${equationViewMode === 'detailed' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}
                  >
                    Detailed View
                  </button>
                </div>
              </div>

              {equationViewMode === 'simple' ? (
                /* SIMPLE VIEW - Clean presentation of key formulas */
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-3">Gini Dampening</h3>
                    <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-sm font-mono">
                      effectiveUBI = totalUBI × (1.5 - gini)
                    </code>
                    <p className="text-xs text-slate-500 mt-2">High inequality reduces UBI effectiveness (0.2 gini = 1.3x, 0.6 gini = 0.9x)</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-3">Corruption Leakage</h3>
                    <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-sm font-mono">
                      localLeakage = localContribution × (1 - governance)
                    </code>
                    <p className="text-xs text-slate-500 mt-2">Low governance = more tax dollars lost to corruption</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-3">Direct-to-Wallet Bypass</h3>
                    <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-sm font-mono">
                      globalUBI = directToWallet ? globalDividend : globalDividend × governance
                    </code>
                    <p className="text-xs text-slate-500 mt-2">Blockchain payments bypass local corruption entirely</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-3">Displacement Gap</h3>
                    <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-sm font-mono">
                      gap = max(0, (monthlyWage × aiAdoption × displacementRate) - totalUBI)
                    </code>
                    <p className="text-xs text-slate-500 mt-2">When lost wages exceed UBI payments, citizens suffer</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-3">Displacement Friction</h3>
                    <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-sm font-mono">
                      friction = sin(aiAdoption × π) × 40 × (1 - governance)^1.5 × (1 + gini × 0.5)
                    </code>
                    <p className="text-xs text-slate-500 mt-2">Mid-transition anxiety peaks at 50% adoption. Power function (1.5) means low-governance countries suffer exponentially more pain. Well-governed democracies buffer transition anxiety through institutions.</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-3">Wellbeing Delta</h3>
                    <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-sm font-mono">
                      Δwellbeing = (ubiBoost × 0.20) - (displacementFriction × 0.12)
                    </code>
                    <p className="text-xs text-slate-500 mt-2">UBI boost coefficient (0.20) now exceeds friction coefficient (0.12), reflecting that in well-governed economies with functional institutions, UBI should outpace displacement anxiety.</p>
                  </div>
                </div>
              ) : (
                /* DETAILED VIEW - Complete equation set for peer review */
                <div className="space-y-8">
                  {/* Introduction */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-2xl">
                    <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
                      <FlaskConical size={18} /> Complete Model Specification
                    </h3>
                    <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                      This section contains all equations necessary to reproduce the simulation. All formulas are applied per country per month unless otherwise specified.
                      Variables with subscript <em>c</em> denote country-specific values. Global parameters are denoted with uppercase symbols.
                    </p>
                  </div>

                  {/* Section 1: AI Adoption Growth */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg border-b border-slate-200 dark:border-slate-700 pb-2">1. AI Adoption Growth</h3>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">1.1 Sigmoid Incentive Modifier</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        sigmoidIncentive = 1 / (1 + exp(k × (adoption - mid)))
                      </code>
                      <p className="text-xs text-slate-500 mt-2">where k = 10, mid = 0.70</p>
                      <p className="text-xs text-slate-500 mt-1">Incentive effectiveness decreases as adoption approaches saturation.</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">1.2 Effective Adoption Incentive</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        effectiveIncentive = adoptionIncentive × sigmoidIncentive
                      </code>
                      <p className="text-xs text-slate-500 mt-2">where adoptionIncentive = model parameter</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">1.3 Governance Adoption Modifier</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre">
{`govModifier = {
  1.2 - (adoption × 0.4)     if governance < 0.5  (autocracy)
  0.9 + (governance × 0.3)   if governance ≥ 0.5  (democracy)
}`}
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Autocracies: fast initial adoption, slow later. Democracies: steady sustained growth.</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">1.4 Regional Economic Modifier</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        regionalModifier = 1 + (gdpPerCapita / 100000)
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Wealthier countries adopt AI faster due to infrastructure and capital availability.</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">1.5 Company Join Probability (Discrete Event)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre">
{`P(join) = aiGrowthRate × regionalModifier × govModifier
         × (1 + effectiveIncentive) × (1 - adoption)

If random() < P(join): add 1-4 companies to companiesJoined`}
                      </code>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">1.6 Continuous Adoption Growth</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre">
{`growth = aiGrowthRate × regionalModifier × (1 + companiesJoined × 0.02)
adoption(t+1) = min(0.999, adoption(t) + growth × (1 - adoption(t)))`}
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Logistic growth capped at 99.9% to prevent division by zero.</p>
                    </div>
                  </div>

                  {/* Section 2: Revenue and Tax Collection */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg border-b border-slate-200 dark:border-slate-700 pb-2">2. Surplus Generation and Tax Collection</h3>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">2.1 Base Surplus Production</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        baseSurplus = adoption^1.6 × population × (gdpPerCapita / 40)
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Power function (1.6) reflects increasing returns to scale in automation.</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">2.2 Network Effect Multiplier</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        networkEffect = 1 + (adoption × 0.4)
                      </code>
                      <p className="text-xs text-slate-500 mt-2">AI systems become more productive as adoption increases (data network effects).</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">2.3 Total Surplus</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        totalSurplus = baseSurplus × networkEffect
                      </code>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">2.4 Raw Fund Contribution (Pre-Corruption)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        rawContribution = totalSurplus × corporateTaxRate
                      </code>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">2.5 Corruption Leakage (Local Tax Only)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre">
{`globalPortion = globalRedistributionRate
localPortion = 1 - globalRedistributionRate

globalContribution = rawContribution × globalPortion
localContribution = rawContribution × localPortion
localLeakage = localContribution × (1 - governance)
effectiveContribution = globalContribution + (localContribution - localLeakage)`}
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Global taxes paid directly to fund (no leakage). Local taxes subject to governance quality.</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">2.6 Global Fund Accumulation</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        globalFund(t+1) = globalFund(t) + Σ(effectiveContribution)
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Sum across all countries</p>
                    </div>
                  </div>

                  {/* Section 3: UBI Distribution */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg border-b border-slate-200 dark:border-slate-700 pb-2">3. UBI Distribution and Effectiveness</h3>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">3.1 Fund Pool Split</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre">
{`globalPool = globalFund × globalRedistributionRate
localPool = globalFund × (1 - globalRedistributionRate)`}
                      </code>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">3.2 Global Dividend (Equal Per Capita)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        globalDividendPerCapita = globalPool / (worldPopulation × 10)
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Division by 10 converts annual to monthly equivalent</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">3.3 Local Dividend (Population-Weighted)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre">
{`countryLocalPool = localPool × (population / worldPopulation)
localDividendRaw = countryLocalPool / (population × 10)
localDividend = localDividendRaw × governance`}
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Local delivery subject to governance quality (corruption in distribution)</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">3.4 Direct-to-Wallet Bypass</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre">
{`globalDividend = {
  globalDividendPerCapita                if directToWallet = true
  globalDividendPerCapita × governance   if directToWallet = false
}`}
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Blockchain/digital identity bypasses corrupt governments entirely</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">3.5 Total UBI Received</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        totalUBI = localDividend + globalDividend
                      </code>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">3.6 Gini Dampening (Inequality Effect)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre">
{`giniDamper = 1.5 - gini
effectiveUBI = totalUBI × giniDamper`}
                      </code>
                      <p className="text-xs text-slate-500 mt-2">High inequality (gini = 0.6) → 0.9× effectiveness. Low inequality (gini = 0.2) → 1.3× effectiveness.</p>
                      <p className="text-xs text-slate-500 mt-1">Rationale: In unequal societies, wealthy save UBI; poor face higher prices.</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">3.7 GDP-Weighted Utility Scaling</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre">
{`logGDP = log₁₀(gdpPerCapita + 1000)
scalingOffset = logGDP - 4
wealthGradient = 1 + (gdpScaling × 0.5 × scalingOffset)
scaledUBI = effectiveUBI × max(0.5, wealthGradient)`}
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Logarithmic scaling: $100 means more to poor than rich (diminishing marginal utility).</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">3.8 UBI Utility Boost (Wellbeing Impact)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre">
{`utilityScale = gdpPerCapita / 40 + 150
ubiBoost = (scaledUBI / utilityScale) × 120`}
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Converts dollars into wellbeing points (0-100 scale)</p>
                    </div>
                  </div>

                  {/* Section 4: Displacement and Friction */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg border-b border-slate-200 dark:border-slate-700 pb-2">4. Job Displacement and Social Friction</h3>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">4.1 Monthly Wage (Baseline)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        monthlyWage = gdpPerCapita / 12
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Assumes GDP per capita represents average annual income</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">4.2 Lost Wages from Displacement</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        lostWages = monthlyWage × adoption × displacementRate
                      </code>
                      <p className="text-xs text-slate-500 mt-2">At 100% AI adoption, displacementRate fraction of labor income is lost</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">4.3 Displacement Gap</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        displacementGap = max(0, lostWages - totalUBI)
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Positive gap indicates UBI is insufficient to replace lost income</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">4.4 Base Friction (Governance Buffering)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        baseFriction = 40 × (1 - governance)^1.5 × (1 + gini × 0.5)
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Power function (1.5) means low-governance countries feel exponentially more pain</p>
                      <p className="text-xs text-slate-500 mt-1">Well-governed democracies buffer transitions via institutions, retraining, safety nets</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">4.5 Displacement Friction (Transition Anxiety)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        displacementFriction = sin(adoption × π) × baseFriction
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Sine function peaks at 50% adoption (mid-transition chaos)</p>
                      <p className="text-xs text-slate-500 mt-1">At 0% and 100% adoption, friction is minimal (stability)</p>
                    </div>
                  </div>

                  {/* Section 5: Wellbeing Calculation */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg border-b border-slate-200 dark:border-slate-700 pb-2">5. Wellbeing Calculation</h3>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">5.1 Base Wellbeing Update</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        wellbeingBase = wellbeing(t) + (ubiBoost × 0.20) - (displacementFriction × 0.12)
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Coefficients: α = 0.20 (UBI boost), β = 0.12 (friction)</p>
                      <p className="text-xs text-slate-500 mt-1">Rebalanced: UBI now outpaces friction in well-governed economies</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">5.2 Crisis Detection and Penalty</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre">
{`if displacementGap > monthlyWage × 0.3:
  crisisPenalty = min(5, (displacementGap / monthlyWage) × 10)
  wellbeingBase -= crisisPenalty
  countriesInCrisis += 1`}
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Penalty capped at 5 points: societies adapt via informal economies, family networks</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">5.3 Subsistence Floor Bonuses</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre">
{`subsistenceFloor = gdpPerCapita / 25

if adoption > 0.60 and totalUBI < subsistenceFloor:
  wellbeingBase -= 1.5
else if totalUBI > subsistenceFloor × 2.5:
  wellbeingBase += 2.0`}
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Penalty: High automation without subsistence UBI = severe hardship</p>
                      <p className="text-xs text-slate-500 mt-1">Bonus: UBI &gt; 2.5× subsistence = thriving (nutrition, education, healthcare access)</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">5.4 Final Wellbeing (Bounded)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        wellbeing(t+1) = max(1, min(100, wellbeingBase))
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Wellbeing bounded to [1, 100] scale</p>
                    </div>
                  </div>

                  {/* Section 6: Shadow Simulation (Counterfactual) */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg border-b border-slate-200 dark:border-slate-700 pb-2">6. Shadow Simulation (No-Intervention Baseline)</h3>
                    <p className="text-xs text-slate-500 italic">
                      Counterfactual scenario showing what happens WITHOUT UBI intervention. Validates model by demonstrating intervention effectiveness.
                    </p>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">6.1 Shadow Adoption Growth (Slower)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre">
{`shadowGrowth = aiGrowthRate × 0.5 × regionalModifier × (1 - shadowAdoption(t))
shadowAdoption(t+1) = min(0.999, shadowAdoption(t) + shadowGrowth)`}
                      </code>
                      <p className="text-xs text-slate-500 mt-2">50% speed: No incentives to automate (no UBI system exists)</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">6.2 Shadow Wage (Collapsing Income)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        shadowWage = monthlyWage × (1 - shadowAdoption × 0.9)
                      </code>
                      <p className="text-xs text-slate-500 mt-2">90% displacement with NO UBI buffer (vs. displacementRate with intervention)</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">6.3 Shadow Subsistence (Stress Adjustment)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre">
{`shadowSubsistence = gdpPerCapita / 25
subsistenceAdjusted = shadowSubsistence × (shadowWage < 800 ? 1.7 : 1)`}
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Survival costs increase under economic stress (prices rise, hoarding, black markets)</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">6.4 Shadow Wellbeing (Michaelis-Menten Curve)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre">
{`r = shadowWage / (shadowWage + subsistenceAdjusted)
shadowWellbeing = max(1, min(100, r × 100))`}
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Basic survival economics: wellbeing approaches zero as income approaches zero</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">6.5 Shadow Friction (Amplified)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre">
{`shadowFriction = sin(shadowAdoption × π) × baseFriction × 2.0
shadowWellbeing = max(1, shadowWellbeing - shadowFriction × 0.4)`}
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Doubled friction: No safety net = worse social cohesion breakdown</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">6.6 Instability Penalty (High Adoption without UBI)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre">
{`if shadowAdoption > 0.5:
  instabilityPenalty = (shadowAdoption - 0.5)² × 20
  shadowWellbeing = max(1, shadowWellbeing - instabilityPenalty)`}
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Mass unemployment without safety net leads to riots, political breakdown, instability</p>
                    </div>
                  </div>

                  {/* Section 7: Global Aggregates */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg border-b border-slate-200 dark:border-slate-700 pb-2">7. Global Aggregate Metrics</h3>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">7.1 Average Global Wellbeing</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        averageWellbeing = Σ(wellbeing) / numberOfCountries
                      </code>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">7.2 Global Displacement Gap</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        globalDisplacementGap = Σ(displacementGap × population)
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Total aggregate lost wages minus UBI across all countries</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">7.3 Total Corruption Leakage (Monthly)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        corruptionLeakage = Σ(localLeakage)
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Tax dollars lost to corrupt governments each month</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">7.4 Countries in Crisis Count</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono">
                        countriesInCrisis = count(displacementGap &gt; monthlyWage × 0.3)
                      </code>
                      <p className="text-xs text-slate-500 mt-2">Number of countries where UBI insufficient to cover job losses</p>
                    </div>
                  </div>

                  {/* Summary Section */}
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-6 rounded-2xl">
                    <h3 className="font-bold text-emerald-900 dark:text-emerald-300 mb-3">Model Reproduction Notes</h3>
                    <ul className="text-xs text-emerald-800 dark:text-emerald-200 space-y-2 leading-relaxed">
                      <li><strong>Initial Conditions:</strong> All countries start at adoption(0) = 0.01, wellbeing(0) = min(100, max(10, gdpPerCapita/1200 + 40))</li>
                      <li><strong>Time Step:</strong> One month per iteration</li>
                      <li><strong>Constants:</strong> World population = Σ(population), calculated from initial country data</li>
                      <li><strong>Stochastic Elements:</strong> Company joining (section 1.5) uses uniform random variable ∈ [0,1]</li>
                      <li><strong>Country Parameters:</strong> gdpPerCapita, population, governance, gini are fixed per country throughout simulation</li>
                      <li><strong>Global Parameters:</strong> corporateTaxRate, adoptionIncentive, aiGrowthRate, displacementRate, gdpScaling, globalRedistributionRate, directToWallet are user-controlled model settings</li>
                      <li><strong>Coefficient Rationale:</strong> α=0.20, β=0.12 calibrated so well-governed democracies (governance &gt; 0.8) reach 70-90 wellbeing at equilibrium</li>
                    </ul>
                  </div>
                </div>
              )}
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
        </section>
      </main>

      <footer className="px-4 lg:px-6 py-3 lg:py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky bottom-0 z-[100] backdrop-blur-md shrink-0">
        <SimulationControls isPlaying={isPlaying} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onReset={handleReset} onStep={stepSimulation} speed={speed} setSpeed={setSpeed} month={state.month} maxMonth={history.length > 0 ? Math.max(...history.map(h => h.month)) : state.month} onSeek={handleSeek} />
      </footer>

      {/* Corporation Detail Panel (P5-T10) */}
      <CorporationDetailPanel
        corporation={selectedEntity?.type === 'corporation' ? corporations.find(c => c.id === selectedEntity.id) || null : null}
        onClose={handleDeselectEntity}
        onUpdateCorp={updateCorporation}
      />

      {/* Country Detail Panel (P7-T2) */}
      <CountryDetailPanel
        country={selectedEntity?.type === 'country' ? state.countryData[selectedEntity.id] || null : null}
        corporations={corporations}
        onClose={handleDeselectEntity}
        onUpdateCountry={updateCountry}
      />
    </div>
  );
};

export default App;

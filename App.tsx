import { historyThroughCurrent, writeRecoverySnapshot } from './simulation/appState';
import { assertRunSupported, resolveRunCapabilities } from './simulation/capabilities';
import { conditionalWorld } from './simulation/conditionalWorld';
import { evaluateConditionalSnapshot, noCorporateUbiInputs } from './simulation/run';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis, ReferenceLine } from 'recharts';
import { Globe, TrendingUp, TrendingDown, Sparkles, Share2, ChevronDown, BrainCircuit, FlaskConical, Database, MousePointer2, PlayCircle, Menu, X, BookOpen, Lightbulb, ArrowRight, ArrowLeft, Info, FileText, Sun, Moon, Copy, Settings, Download, Upload, Trophy } from 'lucide-react';
import WorldMap from './components/WorldMap';
import SimulationControls from './components/SimulationControls';
import MotionChart from './components/MotionChart';
import CorporationList from './components/CorporationList';
import CorporationDetailPanel from './components/CorporationDetailPanel';
import CountryDetailPanel from './components/CountryDetailPanel';
import GameTheoryVisualization from './components/GameTheoryVisualization';
import { WellbeingScatterPlot } from './components/WellbeingScatterPlot';
import { ModelUpload } from './components/ModelUpload';
import { ModelEditor } from './components/ModelEditor';
import { Leaderboard } from './components/Leaderboard';
import { ModelDetail } from './components/ModelDetail';
import { ModelRating } from './components/ModelRating';
import FuturesTab from './components/futures/FuturesTab';
import LabTab from './components/lab/LabTab';
import ActivePolicyResultView from './components/lab/ActivePolicyResultView';
import { sharedRoute, recognizedShareHash, type AppTab } from './components/lab/navigation';
import { resolveQualification } from './simulation/qualification';
import { unsupportedPolicyView, type ActiveRunView } from './components/lab/activeRunView';
import ModelCardTab from './components/modelcard/ModelCardTab';
import { InterventionImportPanel } from './components/futures/InterventionImportPanel';
import { LOCKED_GRAPH, LOCKED_INTERVENTIONS, loadCustomInterventions, saveCustomInterventions } from './src/futures/data';
import type { Intervention } from './src/futures/types';
import { SimulationState, ModelParameters, HistoryPoint, CountryStats, Corporation, SavedState, SelectedEntity, ModelConfig, StoredModel } from './types';
import { PRESET_MODELS, INITIAL_COUNTRIES, INITIAL_CORPORATIONS, SCENARIO_PRESETS, DEFAULT_MODEL_CONFIG, DEFAULT_MODEL, COUNTRY_DATASET_ID, isCountryDatasetId, type CountryDatasetId } from './constants';
import { encodeSharePayload, decodeSharePayload } from './src/services/scenarioShare';
import { getRedTeamAnalysis, getSimulationSummary } from './services/geminiService';
import { rateModel, getLeaderboard, recordRun, listModels } from './src/services/modelStorage';
import { parseEquationSet, CompiledEquationSet, EquationError } from './src/services/equationParser';
import { advanceRun, initialRun, type RunInputs, type SimulationRun, initOptionsFor } from './simulation/run';
import { US_REFERENCE_LAST_WORLD_MONTH } from './simulation/usReference';
import {
  catchUp, corporationEditForCounterfactual, editCorporation, editCountry, headlineStats, historyForPrompt, historyForSave,
  historyFromSave, rebuildCounterfactual, recordRunInHistory, seekInHistory, seekWithCounterfactual, stepWithCounterfactual,
} from './simulation/appState';
import { formatBillionsUsd, formatUsdPerPerson, millionsToBillionsUsd } from './simulation/units';
import EquationErrorBanner from './components/EquationErrorBanner';
import GuidedExperience, { type LabEntry } from './components/guided/GuidedExperience';
import { initialGuidedMode } from './components/guided/navigation';

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

/** Population-unweighted mean AI adoption across the simulated countries. */
const averageAdoption = (s: SimulationState) => {
    const countries = Object.values(s.countryData);
    if (countries.length === 0) return 0;
    return countries.reduce((acc, c) => acc + c.aiAdoption, 0) / countries.length;
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
                        <button onClick={onNext} className="bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:scale-105 transition-transform flex items-center gap-1">
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
const App: React.FC = () => {
  const [model, setModel] = useState<ModelParameters>(DEFAULT_MODEL);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [initialRoute] = useState(() => typeof window === 'undefined' ? sharedRoute('', '') : sharedRoute(window.location.search, window.location.hash));
  const [guidedMode, setGuidedMode] = useState<'explore' | 'compare' | null>(() => typeof window === 'undefined' ? 'explore' : initialGuidedMode(window.location.search, window.location.hash));
  const [activeTab, setRawActiveTab] = useState<AppTab>(initialRoute.tab);
  const setActiveTab = useCallback((tab: AppTab) => { setGuidedMode(null); setRawActiveTab(tab); }, []);
  const [labEntry, setLabEntry] = useState<{ kind: LabEntry; sequence: number } | undefined>();
  const openLab = (kind?: LabEntry) => { setActiveTab('lab'); setSelectedEntity(null); if (kind) setLabEntry(old => ({kind, sequence:(old?.sequence ?? 0)+1})); };
  const openGuided = (mode: 'explore' | 'compare') => { if (shareError) { setGuidedMode(null); setRawActiveTab('map'); return; } setRawActiveTab('map'); setGuidedMode(mode); setIsPlaying(false); setSelectedEntity(null); setAboutDropdownOpen(false); };
  const openDividend = () => { setResultFamily('world'); setShareError(null); openGuided('explore'); requestAnimationFrame(() => document.getElementById('guided-corporation')?.focus()); };
  const [labVisited, setLabVisited] = useState(false);
  const [activePolicy, setActivePolicy] = useState<ActiveRunView | null>(null);
  const [resultFamily, setResultFamily] = useState<'world' | 'lab-policy'>(initialRoute.policy ? 'lab-policy' : 'world');
  const [guidedError, setGuidedError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  useEffect(() => { if (activeTab === 'lab') setLabVisited(true); }, [activeTab]);
  const publishPolicy = React.useCallback((view: ActiveRunView) => { setActivePolicy(view); if (activeTab === 'lab' && view.status !== 'empty') setResultFamily('lab-policy'); }, [activeTab]);
  const openPolicyCharts = () => { setResultFamily('lab-policy'); setActiveTab('charts'); setSelectedEntity(null); };
  const switchToWorld = () => { setResultFamily('world'); setShareError(null); setActiveTab('map'); };
  const [customInterventions, setCustomInterventions] = useState<Intervention[]>(() => loadCustomInterventions());
  // Mount-only payload parsers must be re-entered for a newly opened share hash.
  // Ordinary tabs preserve the Lab; explicit share links intentionally open a new scenario.
  useEffect(() => {
    const openHash = () => { if (recognizedShareHash(window.location.hash)) window.location.reload(); };
    window.addEventListener('hashchange', openHash);
    return () => window.removeEventListener('hashchange', openHash);
  }, []);
  const [viewMode, setViewMode] = useState<'adoption' | 'wellbeing'>('wellbeing'); // Default to wellbeing
  const [equationViewMode, setEquationViewMode] = useState<'simple' | 'detailed'>('simple');
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null); // Archetype filter for map

  // Comparison mode state (P7-T5)
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonScenarioId, setComparisonScenarioId] = useState<string>('free-market-optimism');

  // Models tab mode state (P8-T13)
  const [modelMode, setModelMode] = useState<'upload' | 'edit'>(initialRoute.edit ? 'edit' : 'upload');

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
  /**
   * The sidebar (world model presets, scenarios, parameters) and the footer clock (play, step,
   * month slider) drive the WORLD simulation. The Lab and the Model Card are about other models
   * with their own calendars, so those controls are hidden there rather than shown next to an
   * unrelated model (review 2026-09-14, stage 5 gap "Other tabs still use unrelated world state").
   */
  const showWorldControls = !guidedMode && resultFamily === 'world' && !shareError && !['lab', 'modelcard', 'models', 'futures'].includes(activeTab);
  const [showStartHint, setShowStartHint] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const shareDialog = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showShareModal) return;
    const previous = document.activeElement as HTMLElement | null;
    shareDialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, [showShareModal]);
  
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
  const [viewingModel, setViewingModel] = useState<StoredModel | null>(null);

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

  // ==========================================================================
  // ONE RUN PER PANEL (audit 2026-09-13, findings A3/A4/A7)
  // ==========================================================================
  // The app used to keep countries, corporations, ledger and game theory in four separate
  // hooks, store only the first in history, and write the other three from inside a setState
  // updater. That is why seek mixed the past with the present, the comparison panel never
  // moved and StrictMode double-fired. Each panel now holds ONE `SimulationRun`
  // (simulation/run.ts) advanced by `advanceRun`, and history points carry the whole run.
  // The derived consts below keep the render tree's variable names unchanged.
  // ==========================================================================

  /**
   * The country dataset this session runs on (data/countries/README.md). New sessions use the
   * sourced default; a save or link from before the 2026-09 migration switches the session to
   * 'countries-legacy-v1' so it reproduces, and resets keep whatever the session is on.
   */
  const [countryDataset, setCountryDataset] = useState<CountryDatasetId>(COUNTRY_DATASET_ID);
  const countryDatasetRef = React.useRef(countryDataset);
  countryDatasetRef.current = countryDataset;

  /** The month-0 run the main timeline is anchored to (rebuilt on reset / scenario apply). */
  const [baseRun, setBaseRun] = useState<SimulationRun>(() => initialRun(undefined, undefined, initOptionsFor(DEFAULT_MODEL, COUNTRY_DATASET_ID)));
  const [run, setRun] = useState<SimulationRun>(baseRun);
  /** The corporation roster month 0 starts from: INITIAL_CORPORATIONS, or a scenario's overrides. */
  const [baseCorporations, setBaseCorporations] = useState<Corporation[]>(INITIAL_CORPORATIONS);

  /**
   * The paired no-UBI counterfactual (review 2026-09-14, finding 2): the same month-0 run
   * (`baseRun`), model, equations and corporation edits as the main run, with every contribution
   * rate held at 0. Stepped, sought, reset and rebuilt together with `run`; Charts draws it.
   */
  const [pairedRun, setPairedRun] = useState<SimulationRun>(() => evaluateConditionalSnapshot(baseRun,noCorporateUbiInputs({model:DEFAULT_MODEL})));
  const [pairedHistory, setPairedHistory] = useState<HistoryPoint[]>([]);

  const state = run.state;
  const corporations = run.corporations;
  const globalLedger = run.ledger;
  const gameTheoryState = run.gameTheory;

  // Active custom model configuration (null = use default hardcoded logic) (P8-T9)
  const [activeModelConfig, setActiveModelConfig] = useState<ModelConfig | null>(null);

  // Track if simulation run was recorded (P9-T7)
  const [runRecorded, setRunRecorded] = useState(false);

  // Comparison simulation (P7-T5) - a second, independent run advanced in lockstep
  const [comparisonBaseRun, setComparisonBaseRun] = useState<SimulationRun>(() => initialRun(undefined, undefined, initOptionsFor(DEFAULT_MODEL, COUNTRY_DATASET_ID)));
  const [comparisonRun, setComparisonRun] = useState<SimulationRun>(comparisonBaseRun);
  const [comparisonHistory, setComparisonHistory] = useState<HistoryPoint[]>([]);
  const [comparisonModel, setComparisonModel] = useState<ModelParameters>(DEFAULT_MODEL);

  const comparisonState = comparisonRun.state;
  const comparisonCorporations = comparisonRun.corporations;

  // ==========================================================================
  // CUSTOM MODEL EQUATIONS (audit 2026-09-13, finding A5)
  // ==========================================================================
  // An uploaded model whose equations do not compile used to silently run the built-in engine
  // under the custom model's name. Now the compile result is computed once per model and, when
  // it fails, the app refuses to step and shows the errors. There is no fallback.
  // ==========================================================================
  const parsedEquations = useMemo(
    () => (activeModelConfig ? parseEquationSet(activeModelConfig.equations) : null),
    [activeModelConfig]
  );
  const equationErrors: EquationError[] = parsedEquations && !parsedEquations.valid ? parsedEquations.errors : [];
  const compiledEquations: CompiledEquationSet | undefined = parsedEquations?.compiledEquations;
  /** False while a custom model is active but broken: play, step and replay are all blocked. */
  // A model whose source ends at a date (the US reference ends January 2030) stops there: later
  // months are not modelled, so the clock does not run past them (review 2026-09-14, decision 4(c)).
  const referenceEnded = (!!model.macro?.usReference && state.month >= US_REFERENCE_LAST_WORLD_MONTH) || (state.outOfScope?.length ?? 0) > 0;
  const capabilities = resolveRunCapabilities(model,compiledEquations);
  const qualification = useMemo(() => resolveQualification(model, run, compiledEquations), [model, run, compiledEquations]);
  const comparisonCapabilities = resolveRunCapabilities(comparisonModel,compiledEquations);
  const comparisonEnded = comparisonMode && comparisonCapabilities.lastMonth !== null && comparisonRun.state.month >= comparisonCapabilities.lastMonth;
  const canStep = equationErrors.length === 0 && !capabilities.equationIssue && (!comparisonMode || !comparisonCapabilities.equationIssue) && !referenceEnded && !comparisonEnded;

  const runInputs: RunInputs = useMemo(
    () => ({ model, equations: compiledEquations }),
    [model, compiledEquations]
  );
  const comparisonInputs: RunInputs = useMemo(
    () => ({ model: comparisonModel, equations: compiledEquations }),
    [comparisonModel, compiledEquations]
  );

  /** The current month, readable from effects that must not re-run every step. */
  const monthRef = React.useRef(run.state.month);
  monthRef.current = run.state.month;
  const comparisonInputsRef = React.useRef(comparisonInputs);
  comparisonInputsRef.current = comparisonInputs;
  const canStepRef = React.useRef(canStep);
  canStepRef.current = canStep;

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#share=')) {
      try {
        const base64 = hash.split('#share=')[1];
        // Links made before the 2026-09 country-data migration carry no dataset id and reopen on
        // 'countries-legacy-v1' (src/services/scenarioShare.ts decodeSharePayload).
        const decoded = decodeSharePayload(base64);
        // ONLY Load Model Params
        if (decoded.model) {
            setModel(decoded.model);
            // We consciously do not load history to keep URL small and reliable
            // User starts fresh with the shared parameters, on the link's country dataset
            setCountryDataset(decoded.countryDataset);
            const fresh = decoded.run ?? initialRun(INITIAL_CORPORATIONS, undefined, initOptionsFor(decoded.model, decoded.countryDataset));
            setBaseCorporations(fresh.corporations);
            setBaseRun(fresh);
            setRun(fresh);
            setPairedRun(decoded.model.executionMode ? evaluateConditionalSnapshot(fresh,noCorporateUbiInputs({model:decoded.model})) : fresh);
            setHistory([]);
            setPairedHistory([]);
            const freshB = initialRun(INITIAL_CORPORATIONS, undefined, initOptionsFor(DEFAULT_MODEL, decoded.countryDataset));
            setComparisonBaseRun(freshB);
            setComparisonRun(freshB);
            setComparisonHistory([]);
        }
      } catch (e) {
        setShareError(`Cannot open this shared scenario: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }, []);

  // Leaving the world views for the Lab or Model Card pauses the world clock and closes its drawer,
  // so it does not keep running out of sight.
  useEffect(() => {
    if (!showWorldControls) {
      setIsPlaying(false);
      setIsSidebarOpen(false);
      setSelectedEntity(null);
    }
  }, [showWorldControls]);

  useEffect(() => {
    if (referenceEnded) setIsPlaying(false);
  }, [referenceEnded]);

  // Dismiss start hint when playing
  useEffect(() => {
    if (isPlaying) setShowStartHint(false);
  }, [isPlaying]);

  const generateShareLink = async () => {
    try {
        // STRATEGY: Only share parameters (model). 
        // This ensures URL is tiny and robust.
        const base64 = encodeSharePayload(model, countryDataset, model.executionMode ? run : undefined);
        const url = `${window.location.origin}${window.location.pathname}#share=${base64}`;
        setShareUrl(url);
    } catch (err) {
        console.error("Failed to generate link", err);
        alert("Failed to generate share link.");
    }
  };

  const handleCopyLink = async () => {
    if (shareUrl) {
        try { await navigator.clipboard.writeText(shareUrl); alert("Link copied to clipboard!"); }
        catch { alert("Clipboard unavailable. Select and copy the full link, or use Open shared scenario."); }
    }
  };

  /**
   * Rewind both panels to month 0.
   *
   * `corpsA` lets a caller (applyScenario) hand in the roster month 0 should start from without
   * waiting for a state update to land - the old code called setCorporations and then reset,
   * and the reset wiped the scenario's corporation overrides.
   */
  const resetAll = useCallback((corpsA?: Corporation[], modelForInit?: ModelParameters, datasetForInit?: CountryDatasetId) => {
    const rosterA = corpsA ?? baseCorporations;
    const dataset = datasetForInit ?? countryDataset;
    // Stage 4: anchored models start from observed ladder values, legacy ones from the formula.
    const init = initOptionsFor(modelForInit ?? model, dataset);
    const freshA = initialRun(rosterA, undefined, init);
    setBaseRun(freshA);
    setRun(freshA);
    setHistory([]);
    setPairedRun(init.model?.executionMode ? evaluateConditionalSnapshot(freshA,noCorporateUbiInputs({model:init.model})) : freshA);
    setPairedHistory([]);

    // The comparison panel is reset with its own roster so both start at month 0 together.
    const freshB = initialRun(comparisonBaseRun.corporations, undefined, initOptionsFor(comparisonModel, dataset));
    setComparisonBaseRun(freshB);
    setComparisonRun(freshB);
    setComparisonHistory([]);

    setAnalysis(null);
    setSummary(null);
    setIsPlaying(false);
    setShowStartHint(true);
    // Reset run recording flag (P9-T7)
    setRunRecorded(false);
    window.history.pushState("", document.title, window.location.pathname + window.location.search);
  }, [baseCorporations, comparisonBaseRun, model, comparisonModel, countryDataset]);

  const handleReset = useCallback(() => { resetAll(); }, [resetAll]);

  // ============================================================================
  // MODEL CONFIGURATION MANAGEMENT (P8-T9)
  // ============================================================================
  // Functions to apply, clear, and check custom model configurations
  // ============================================================================

  // Apply a custom model configuration
  const applyModelConfig = useCallback((config: ModelConfig) => {
    setActiveModelConfig(config);
    // A scenario file or link records the country dataset it was made on (legacy when it predates
    // the migration); running it switches the session to that dataset. Models built here have none.
    const dataset = isCountryDatasetId(config.countryDataset) ? config.countryDataset : undefined;
    if (dataset) setCountryDataset(dataset);
    // Reset simulation when applying new model
    resetAll(undefined, undefined, dataset);
  }, [resetAll]);

  // Clear custom model and revert to default
  const clearModelConfig = useCallback(() => {
    setActiveModelConfig(null);
    handleReset();
  }, [handleReset]);

  // Check if using custom model
  const isUsingCustomModel = activeModelConfig !== null;

  // ============================================================================
  // UPDATE CORPORATION (P5-T10)
  // ============================================================================
  // Allows updating individual corporation properties (e.g., from detail panel)
  // ============================================================================

  const updateCorporation = useCallback((id: string, updates: Partial<Corporation>) => {
    setRun(r => { const edited=editCorporation(r,id,updates); return model.executionMode ? conditionalWorld({state:edited.state,corporations:edited.corporations,model},false,true) : edited; });
    // The counterfactual gets the same edit, except its contribution rate stays at 0.
    setPairedRun(r => { const edited=editCorporation(r,id,{...corporationEditForCounterfactual(updates),...(model.executionMode ? {contributionRate:0,fundingRequest:{kind:'share' as const}} : {})}); return model.executionMode ? conditionalWorld({state:edited.state,corporations:edited.corporations,model},false,true) : edited; });
  }, [model]);

  // ============================================================================
  // UPDATE COUNTRY (P7-T2)
  // ============================================================================
  // Allows updating individual country properties (e.g., from detail panel)
  // ============================================================================

  const updateCountry = useCallback((id: string, updates: Partial<CountryStats>) => {
    // Country edits are not the intervention, so both runs of the pair receive them.
    setRun(r => editCountry(r, id, () => updates));
    setPairedRun(r => editCountry(r, id, () => updates));
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
    // 3. Reset simulation to month 0 STARTING FROM those corporations. The old code set the
    // corporations and then called a reset that put INITIAL_CORPORATIONS back, so a scenario's
    // corporation overrides never reached month 1.
    setBaseCorporations(updatedCorps);
    resetAll(updatedCorps);

    console.log(`Applied scenario: ${scenario.name}`);
  }, [model, resetAll]);

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
    const updatedModel = { ...DEFAULT_MODEL, ...scenario.modelParams };
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
    // 3. Build the comparison run at month 0 from those corporations, then bring it up to the
    // month the main panel is already on, so both panels always show the same month
    // (audit 2026-09-13, finding A4: the comparison panel used to sit at month 0 forever).
    const freshB = initialRun(updatedCorps, undefined, initOptionsFor(updatedModel, countryDatasetRef.current));
    // A broken custom model may not be replayed through the built-in engine (A5), so the
    // comparison panel stays at month 0 until the equations compile.
    const target = canStepRef.current ? monthRef.current : 0;
    const caught = catchUp(freshB, target, { model: updatedModel, equations: comparisonInputsRef.current.equations });
    setComparisonBaseRun(freshB);
    setComparisonRun(caught.run);
    setComparisonHistory(caught.history);

    console.log(`Applied comparison scenario: ${scenario.name} (caught up to month ${target})`);
    // monthRef / comparisonInputsRef are read, not depended on: this effect must fire when the
    // scenario or the mode changes, never on every simulated month.
  }, [comparisonMode, comparisonScenarioId]);

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
        version: "2.1",
        timestamp: Date.now(),
        month: state.month,
        // The complete run, plus every history point's run: a reload restores the same
        // simulation rather than countries alone (audit 2026-09-13, finding A6).
        run,
        // The flat fields below are kept so older builds can still open the file.
        corporations,
        countryData: state.countryData,
        globalLedger,
        gameTheoryState,
        model,
        baseRun,
        history: historyForSave(history),
        activeModelConfig,
        countryDataset,
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
  }, [state, run, corporations, globalLedger, gameTheoryState, model, history, activeModelConfig, countryDataset, baseRun]);

  /**
   * Load simulation state from a JSON file
   * Restores all state including history, corporations, and parameters
   */
  /** Restore a saved state (file or autosave) as the whole run, replaying old formats. */
  const restoreSavedState = useCallback((saved: SavedState & { activeModelConfig?: ModelConfig | null }) => {
    if (!saved.version) console.warn('Loading a save with no version field. It will be replayed from month 0.');
    const upload = saved.activeModelConfig ? parseEquationSet(saved.activeModelConfig.equations) : null;
    if(upload && !upload.valid) throw new Error('Saved equations do not compile');
    assertRunSupported(saved.model,saved.run?.state.month ?? saved.month,upload?.compiledEquations);
    const loaded = historyFromSave(saved);
    // Saves from before the 2026-09 country-data migration reopen on 'countries-legacy-v1'.
    setCountryDataset(loaded.countryDataset);
    if (loaded.replayed) console.warn(`[load] ${loaded.note}`);
    else if (loaded.note) console.info(`[load] ${loaded.note}`);
    setBaseRun(loaded.base);
    setBaseCorporations(loaded.base.corporations);
    setRun(loaded.run);
    setHistory(loaded.history);
    // Save files carry only the main timeline; the counterfactual is replayed from the same
    // month-0 run with the saved model (and the saved custom equations, when they compile).
    const savedConfig = saved.activeModelConfig;
    const savedEquations = savedConfig ? parseEquationSet(savedConfig.equations) : null;
    if (!savedEquations || savedEquations.valid) {
      const cf = rebuildCounterfactual(loaded.base, loaded.history, loaded.run.state.month, {
        model: saved.model,
        equations: savedEquations?.compiledEquations,
      });
      setPairedRun(cf.paired);
      setPairedHistory(cf.pairedHistory);
    } else {
      setPairedRun(loaded.base);
      setPairedHistory([]);
    }
    setModel(saved.model);
    if (saved.activeModelConfig !== undefined) setActiveModelConfig(saved.activeModelConfig);
    setIsPlaying(false);
  }, []);

  const loadFromFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const saved = JSON.parse(e.target?.result as string) as SavedState;
        // Restore the WHOLE run (old formats are replayed; see historyFromSave).
        restoreSavedState(saved);
        console.log(`Simulation loaded successfully from ${new Date(saved.timestamp).toLocaleString()}`);
      } catch (err) {
        console.error("Failed to load save file:", err);
        alert("Failed to load save file. The file may be corrupted or incompatible.");
      }
    };
    reader.readAsText(file);

    // Reset the input so the same file can be loaded again
    event.target.value = '';
  }, [restoreSavedState]);

  /**
   * Advance one month.
   *
   * Everything is computed OUTSIDE the state updaters (audit 2026-09-13, finding A7: the old
   * version called setCorporations / setGlobalLedger / setGameTheoryState from inside a
   * setState updater, which double-fires under StrictMode and is how the four pieces of state
   * drifted apart). In comparison mode both runs advance together, each with its own inputs.
   */
  const stepSimulation = useCallback(() => {
    // A5: a custom model whose equations do not compile does NOT fall back to the built-in
    // engine under the custom model's label. It refuses to run and the banner says why.
    if (!canStep) return;

    // The main run and its paired no-UBI counterfactual always advance together.
    const next = stepWithCounterfactual({ run, paired: pairedRun }, runInputs);
    setRun(next.run);
    setHistory(h => recordRunInHistory(h, next.run));
    setPairedRun(next.paired);
    setPairedHistory(h => recordRunInHistory(h, next.paired));

    if (comparisonMode) {
      const nextB = advanceRun(comparisonRun, comparisonInputs);
      setComparisonRun(nextB);
      setComparisonHistory(h => recordRunInHistory(h, nextB));
    }
  }, [canStep, run, pairedRun, runInputs, comparisonMode, comparisonRun, comparisonInputs]);

  useEffect(() => {
    let timer: any;
    if (isPlaying && canStep) {
      // stepSimulation advances the comparison run too, so both panels stay on the same month.
      timer = setInterval(() => { stepSimulation(); }, 1000 / speed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, speed, stepSimulation, canStep]);

  /**
   * Rewind (or fast-forward) to month `m`, restoring the COMPLETE run - countries,
   * corporations, ledger and game theory - not just the countries (finding A3). Points
   * recorded by this build carry their run; older ones are reproduced with replayTo.
   */
  const handleSeek = (m: number) => {
    if(m < baseRun.state.month || (comparisonMode && m < comparisonBaseRun.state.month)) return;
    try { assertRunSupported(model,m,compiledEquations); if(comparisonMode) assertRunSupported(comparisonModel,m,compiledEquations); } catch { return; }
    setIsPlaying(false);
    // Equation errors block every seek but a reset; the end of a reference only blocks moving past it.
    if (equationErrors.length > 0 && m !== 0) return;
    if (model.macro?.usReference && m > US_REFERENCE_LAST_WORLD_MONTH) return;
    const pair = seekWithCounterfactual(history, pairedHistory, m, runInputs, baseRun);
    setRun(pair.run);
    setPairedRun(pair.paired);
    if (comparisonMode) {
      setComparisonRun(seekInHistory(comparisonHistory, m, comparisonInputs, comparisonBaseRun));
    }
  };

  const handleCountryInvestment = (id: string, delta: number) => {
    const invest = (country: CountryStats): Partial<CountryStats> => ({
      companiesJoined: Math.max(0, country.companiesJoined + delta),
      aiAdoption: Math.max(0.01, Math.min(0.999, country.aiAdoption + (delta / 50)))
    });
    setRun(r => editCountry(r, id, invest));
    setPairedRun(r => editCountry(r, id, invest));
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

  // Contribution rates are the counterfactual's one difference, so this edits the main run only.
  const handleBulkUpdateContribution = (newRate: number) => {
    setRun(r => {
      const edited = {...r, corporations:r.corporations.map(corp => selectedCorpIds.has(corp.id)
        ? {...corp,contributionRate:newRate,...(model.executionMode ? {fundingRequest:{kind:'share' as const}} : {})}
        : corp)};
      return model.executionMode ? conditionalWorld({state:edited.state,corporations:edited.corporations,model},false,true) : edited;
    });
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
    const res = await getSimulationSummary(model, historyForPrompt(history));
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
    const res = await getRedTeamAnalysis(model, historyForPrompt(history));
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

  const visibleChartHistory = useMemo(() => capabilities.conditional
    ? historyThroughCurrent(history, baseRun, run)
    : history.filter(point => point.month <= state.month), [capabilities.conditional, history, baseRun, run, state.month]);
  const visiblePairedHistory = useMemo(() => capabilities.conditional
    ? historyThroughCurrent(pairedHistory, evaluateConditionalSnapshot(baseRun, noCorporateUbiInputs({model})), pairedRun)
    : pairedHistory, [capabilities.conditional, pairedHistory, baseRun, model, pairedRun]);

  const chartData = useMemo(() => {
    return visibleChartHistory.map(point => {
      const data: any = {
          month: point.month,
          date: formatMonthDate(point.month),
          // globalFund is already billions USD (the global pool this month).
          fund: point.state.globalFund
      };
      data['Wellbeing_Global'] = point.state.conditionalSummary ? point.state.conditionalSummary.value : point.state.averageWellbeing;
      const globalAdoption = (Object.values(point.state.countryData) as CountryStats[]).reduce((acc, curr) => acc + curr.aiAdoption, 0) / INITIAL_COUNTRIES.length * 100;
      data['Adoption_Global'] = globalAdoption;

      // Global displacement gap
      if (!capabilities.conditional) data['DisplacementGap_Global'] = millionsToBillionsUsd(point.state.globalDisplacementGap); // USD/person x millions of people -> billions

      Object.keys(point.state.countryData).forEach(id => {
        data[`Wellbeing_${id}`] = point.state.countryData[id].conditionalWellbeing?.raw ?? point.state.countryData[id].wellbeing;
        data[`Adoption_${id}`] = point.state.countryData[id].aiAdoption * 100;
        if (!capabilities.conditional) data[`DisplacementGap_${id}`] = (point.state.countryData[id].displacementGap || 0) / 1000; // Convert to thousands
      });
      return data;
    });
  }, [visibleChartHistory, capabilities.conditional]);

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
      const build = (withRuns: boolean): SavedState => ({
        version: "2.1",
        timestamp: Date.now(),
        month: state.month,
        run,
        corporations,
        countryData: state.countryData,
        globalLedger,
        gameTheoryState,
        model,
        // Full runs per point make the timeline seekable after a restore. They are also the
        // bulk of the payload. Only legacy saves can fall back to chartable states; conditional
        // saves need their complete snapshot history. Failed writes preserve the prior recovery.
        baseRun,
        history: model.executionMode ? historyForSave(history) : withRuns ? historyForSave(history) : historyForPrompt(history),
        activeModelConfig,  // P8-T9: Include custom model config
        countryDataset,
      });
      const result = writeRecoverySnapshot(localStorage, build(true), model.executionMode ? undefined : () => build(false));
      if (result.saved) {
        console.log(result.reduced ? 'Auto-save: saved reduced legacy history; seek will replay.' : `Auto-saved at ${new Date().toLocaleTimeString()}`);
      } else {
        console.error('Auto-save failed; the last successful recovery was preserved.', result.error);
      }

    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [state, run, corporations, globalLedger, gameTheoryState, model, history, activeModelConfig, countryDataset, baseRun]);

  // Autosave found on mount: offer to restore it in-page. A native confirm() dialog blocked the
  // whole page (and any automation) until dismissed, so it is a banner with two buttons instead.
  const [pendingAutosave, setPendingAutosave] = useState<(SavedState & { activeModelConfig?: ModelConfig | null }) | null>(null);
  useEffect(() => {
    try {
      const autoSave = localStorage.getItem('ubi-sim-autosave');
      if (autoSave && state.month === 0) setPendingAutosave(JSON.parse(autoSave));
    } catch (err) {
      console.error("Failed to read auto-save:", err);
      localStorage.removeItem('ubi-sim-autosave');
    }
  }, []); // Only run on mount
  const restoreAutosave = useCallback(() => {
    const saved = pendingAutosave;
    if (!saved) return;
    try {
      restoreSavedState(saved);
      console.log('Auto-save restored successfully');
    } catch (err) {
      console.error("Failed to load auto-save:", err);
      localStorage.removeItem('ubi-sim-autosave');
    }
    setPendingAutosave(null);
  }, [pendingAutosave]);
  const discardAutosave = useCallback(() => { localStorage.removeItem('ubi-sim-autosave'); setPendingAutosave(null); }, []);

  // Record simulation run when reaching month 60 (P9-T7)
  useEffect(() => {
    // Only record if we have a custom model and reached month 60
    if (state.month === 60 && activeModelConfig && !runRecorded) {
      try {
        // Find the stored model ID (if it was saved to storage)
        const storedModels = listModels();
        const matchingModel = storedModels.find(
          m => m.modelConfig.name === activeModelConfig.name &&
               m.modelConfig.metadata.version === activeModelConfig.metadata.version
        );

        if (matchingModel) {
          // Determine game theory outcome
          let gameTheoryOutcome: 'virtuous-cycle' | 'prisoners-dilemma' | 'race-to-bottom' | 'mixed' = 'mixed';
          if (gameTheoryState.virtuousCycleStrength > 0.6) {
            gameTheoryOutcome = 'virtuous-cycle';
          } else if (gameTheoryState.raceToBottomRisk > 0.6) {
            gameTheoryOutcome = 'race-to-bottom';
          } else if (gameTheoryState.isInPrisonersDilemma) {
            gameTheoryOutcome = 'prisoners-dilemma';
          }

          recordRun(matchingModel.id, {
            finalMonth: state.month,
            finalWellbeing: state.averageWellbeing,
            finalFundSize: globalLedger.totalFunds,
            countriesInCrisis: state.countriesInCrisis,
            gameTheoryOutcome,
            avgContributionRate: gameTheoryState.avgContributionRate,
            modelName: activeModelConfig.name,
            modelVersion: activeModelConfig.metadata.version
          });

          setRunRecorded(true);
          console.log('Run recorded for model:', activeModelConfig.name);
        }
      } catch (error) {
        console.error('Failed to record run:', error);
      }
    }
  }, [state.month, activeModelConfig, runRecorded, state.averageWellbeing, globalLedger.totalFunds, state.countriesInCrisis, gameTheoryState]);

  return (
    <div className={`guided-shell flex flex-col h-[100dvh] overflow-hidden ${theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
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
            <div ref={shareDialog} role="dialog" aria-modal="true" aria-labelledby="share-dialog-title" onKeyDown={e=>{if(e.key==='Escape'){setShowShareModal(false);return;}if(e.key==='Tab'){const nodes=Array.from((e.currentTarget as HTMLDivElement).querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled])'));const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}} className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <button aria-label="Close scenario sharing" onClick={() => setShowShareModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"><X size={20}/></button>
                
                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Settings size={24} />
                    </div>
                    <h3 id="share-dialog-title" className="text-xl font-bold text-slate-900 dark:text-white mb-1">Share scenario</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Share the current inputs and accounting snapshot.</p>
                </div>

                {!shareUrl ? (
                    <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-xl flex gap-3 text-left">
                            <Info className="text-blue-600 dark:text-blue-400 shrink-0" size={20} />
                            <div className="space-y-1">
                                <h4 className="text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-wide">Sharing Info</h4>
                                <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">Conditional links preserve the current corporate requests and economic inputs at the displayed month. Accounting is recomputed on opening; earlier history and macro inputs are not independently verified. Legacy links share settings only. Complete links can be too long for some messaging services; save a scenario file when sharing through those channels.</p><button className="underline min-h-11" onClick={saveToFile}>Download complete scenario file</button>
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
                            <input aria-label="Full shared scenario link" readOnly value={shareUrl} className="w-full bg-transparent" />
                            <a href={shareUrl} target="_blank" rel="noreferrer" className="underline">Open shared scenario</a>
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

      <header className="guided-header">
        <button className="guided-brand" onClick={() => openGuided('explore')} aria-label="Transition Engine home"><Globe size={25} aria-hidden="true"/><span>Transition Engine</span></button>
        <nav className="guided-primary-nav" aria-label="Primary navigation">
          <button aria-current={guidedMode === 'explore' ? 'page' : undefined} onClick={() => openGuided('explore')}>Explore</button>
          <button aria-current={guidedMode === 'compare' ? 'page' : undefined} onClick={() => openGuided('compare')}>Compare</button>
          <button aria-current={!guidedMode && activeTab === 'lab' ? 'page' : undefined} onClick={() => openLab()}>Model Lab</button>
        </nav>
        <div className="guided-utilities">
          <details className="guided-about" onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();}}}><summary>About</summary><nav aria-label="About and advanced views">{([['guide','Guide'],['overview','Overview'],['modelcard','Model card'],['equations','Sources and equations'],['analysis','Analysis'],['models','World model editor'],['leaderboard','Leaderboard']] as const).map(([tab,label]) => <button key={tab} onClick={e => {setActiveTab(tab);setSelectedEntity(null);e.currentTarget.closest('details')?.removeAttribute('open');}}>{label}</button>)}</nav></details>
          <button className="guided-theme" onClick={() => setTheme(t=>t==='dark'?'light':'dark')} aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'}>{theme==='dark'?<Sun size={19}/>:<Moon size={19}/>}</button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex relative">
        {/* Mobile Backdrop */}
        {showWorldControls && isSidebarOpen && (
            <div 
                className="fixed inset-0 bg-black/60 z-[140] lg:hidden backdrop-blur-sm transition-opacity"
                onClick={() => setIsSidebarOpen(false)}
            />
        )}

        {/* Sidebar Navigation (world simulation only) */}
        <aside hidden={!showWorldControls} className={`
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
                {[DEFAULT_MODEL, ...PRESET_MODELS.filter(m => m.id !== DEFAULT_MODEL.id)].map(m => (
                    <button
                    key={m.id}
                    onClick={() => {
                      setModel({ ...m, isCustom: false });
                      // A preset that starts from a different wellbeing scale (anchored: observed ladder
                      // values) cannot continue the current run; restart at month 0 with it.
                      if (m.executionMode !== model.executionMode || initOptionsFor(m).initialWellbeing !== initOptionsFor(model).initialWellbeing) resetAll(undefined, m);
                      if(window.innerWidth < 1024) setIsSidebarOpen(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all ${model.id === m.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'}`}
                    >
                    {m.name}
                    </button>
                ))}
                </div>
            </div>

            <div>
                <h2 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  Legacy Scenario Presets
                  <InfoTooltip text="Pre-configured scenarios demonstrating different game theory outcomes: cooperation, defection, protectionism, etc." />
                </h2>
                <div className="space-y-2">
                {!capabilities.conditional && SCENARIO_PRESETS.map(scenario => (
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
                  {!capabilities.conditional && SCENARIO_PRESETS.map(scenario => (
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
                    // `engine: false` marks parameters the built-in engine never reads (model card, finding C6).
                    // They stay editable because custom equation sets may use them.
                    { label: 'Surplus Tax', key: 'corporateTaxRate', unit: '%', step: 0.01, min: 0, max: 0.9, multiplier: 100, engine: false },
                    { label: 'Adoption Incentive', key: 'adoptionIncentive', unit: '', step: 0.01, min: 0, max: 1.0, multiplier: 1, engine: false },
                    { label: 'Growth Speed', key: 'aiGrowthRate', unit: '%', step: 0.01, min: 0.01, max: 0.4, multiplier: 100, engine: true },
                    { label: 'GDP Scaling', key: 'gdpScaling', unit: '', step: 0.05, min: 0, max: 1.0, multiplier: 1, engine: true },
                ].filter(p => capabilities.supportedControls.includes(p.key)).map(p => (
                    <div key={p.key}>
                    <div className="flex justify-between text-[10px] mb-2 font-mono text-slate-500 dark:text-slate-400"><span>{p.label}{!p.engine && <span title="The built-in engine does not read this parameter; see docs/design/model-card-default.md" className="ml-1 px-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-sans normal-case">not used by engine</span>}</span><span className="text-slate-900 dark:text-white">{(model as any)[p.key] * p.multiplier}{p.unit}</span></div>
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
                ].filter(p => capabilities.supportedControls.includes(p.key)).map(p => (
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

{!capabilities.conditional && <>
            <div>
                <h2 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">Corporation Policy</h2>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-[10px] mb-2 font-mono text-slate-500 dark:text-slate-400">
                      <span className="flex items-center">Default Corp Policy<InfoTooltip text="Initial policy stance for all corporations at simulation start." /></span>
                    </div>
                    <select
                      disabled={capabilities.conditional}
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
                      disabled={capabilities.conditional}
                      value={model.marketPressure}
                      onChange={(e) => setModel({ ...model, marketPressure: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                  </div>
                </div>
            </div>

</>}

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
                    {capabilities.conditional ? 'Requests and allocation routes are fixed scenario inputs. Contributions are limited to the modeled source pool. Customer demand, reputation reactions and national adaptation are not modeled.' : 'In the legacy model, UBI contributions change under assumed customer-preservation and reputation rules.'}
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
        <section id="main-content" className={`guided-main flex-1 overflow-y-auto relative h-full ${guidedMode ? '' : 'p-4 lg:p-6 bg-slate-50 dark:bg-slate-950'}`}>
          {guidedMode && pendingAutosave && <div className="guided-recovery" role="status"><span>A saved scenario from {new Date(pendingAutosave.timestamp).toLocaleString()} is available (month {pendingAutosave.month}).</span><button onClick={restoreAutosave}>Restore saved scenario</button><button onClick={discardAutosave}>Discard saved scenario</button></div>}
          {guidedMode && <GuidedExperience mode={guidedMode} model={model} run={run} paired={pairedRun} qualification={qualification} equationIssue={capabilities.equationIssue} error={guidedError} activePolicy={resultFamily === 'lab-policy'}
            onUpdate={(id,patch)=>{try { evaluateConditionalSnapshot(editCorporation(run,id,patch),{model}); updateCorporation(id,patch);setGuidedError(null); }catch(e){setGuidedError(`Changes were not applied: ${String(e)}`);} }} onModel={next => { try {const a=evaluateConditionalSnapshot(run,{model:next});const b=evaluateConditionalSnapshot(pairedRun,noCorporateUbiInputs({model:next}));setModel(next);setRun(a);setPairedRun(b);setGuidedError(null);}catch(e){setGuidedError(`Changes were not applied: ${String(e)}`);} }} onLab={openLab} onView={tab => { if(tab==='futures') setResultFamily('world'); setActiveTab(tab); }}
            onDividend={openDividend} onCompare={()=>openGuided('compare')} onMapCompare={()=>{setComparisonMode(true);setActiveTab('map');}}
            onPolicyCompare={openPolicyCharts} onShare={()=>{setShareUrl(null);setShowShareModal(true);}} onSave={saveToFile}/>}
          <div hidden={!!guidedMode} className="guided-existing-content">
          {!guidedMode && showWorldControls && <nav className="guided-view-nav" aria-label="World views"><button onClick={()=>setIsSidebarOpen(!isSidebarOpen)}>World settings</button>{(['map','charts','corporations'] as const).map(tab=><button key={tab} aria-current={activeTab===tab?'page':undefined} onClick={()=>setActiveTab(tab)}>{tab==='map'?'Map':tab==='charts'?'Charts':'Corporations'}</button>)}<button onClick={()=>{setShareUrl(null);setShowShareModal(true);}}>Share scenario</button><button onClick={saveToFile}>Save scenario</button><label>Load scenario<input type="file" accept=".json" onChange={loadFromFile}/></label></nav>}

          {shareError && <div role="alert" className="p-4 border border-red-500 rounded-lg"><p>{shareError}</p><p>The shared result was not opened.</p><button className="underline min-h-11" onClick={switchToWorld}>Start a new world scenario</button></div>}
          {resultFamily === 'lab-policy' && activeTab === 'charts' && <ActivePolicyResultView view={activePolicy} onAuthor={() => setActiveTab('lab')} onWorld={switchToWorld} />}
          {resultFamily === 'lab-policy' && !['lab', 'charts', 'models', 'guide', 'modelcard'].includes(activeTab) && <div className="space-y-4"><h2 className="font-bold">This view does not support the selected Lab policy result</h2><p>{unsupportedPolicyView}</p><button className="underline min-h-11 mr-4" onClick={openPolicyCharts}>View policy Charts</button><button className="underline min-h-11" onClick={() => { setResultFamily('world'); setSelectedEntity(null); }}>Switch to {activeTab === 'futures' ? 'the separate Futures model' : 'world model'}</button></div>}
          {/* Active run identity (review 2026-09-14, stage-5 gap 3): every view says which model its numbers come from. */}
          {resultFamily === 'world' && !shareError && (activeTab === 'map' || activeTab === 'charts' || activeTab === 'corporations') && (
            <p data-testid="active-model" className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">
              World simulation · <span className="font-semibold text-slate-700 dark:text-slate-200">{activeModelConfig ? `${activeModelConfig.name} (uploaded equations)` : model.name}</span> · month {state.month}. The Model Lab and the AI Futures Map are separate models and do not feed this view. {capabilities.conditional && <span>Accounting: {qualification.accounting === 'reviewed-conditional' ? 'independently reviewed at this exact default point' : 'unreviewed scenario point (not a computation failure)'}. Macro and wellbeing: illustrative. Money: constant-2015 USD; residents: modeled roster.</span>}
            </p>
          )}
          {showWorldControls && state.sourceAccounting && ['map','charts','corporations'].includes(activeTab) && <p className="mb-3 text-xs" data-testid="source-accounting">Modeled source accounting (constant-2015 USD billions/month): source {state.sourceAccounting.source.toFixed(4)} · funded {state.sourceAccounting.actual.toFixed(4)} · receipts {state.sourceAccounting.receipts.toFixed(4)} · retained / unused {state.sourceAccounting.unused.toFixed(4)} · reserved {state.sourceAccounting.reserved.toFixed(4)} · unfunded {state.sourceAccounting.unfunded.toFixed(4)}. Transfer-to-macro effects are unestimated; equal macro curves do not measure zero effect.</p>}
          {resultFamily === 'world' && !shareError && activeTab === 'futures' && (
            <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">AI Futures Map · a separate influence model with its own assumptions; it does not read or drive the world simulation.</p>
          )}
          {resultFamily === 'world' && !shareError && activeTab === 'map' && (
            <div className="h-full flex flex-col gap-2">
              {/* Compact Stats Row - Primary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0">
                {/* Review 2026-09-14 finding 13: values come from headlineStats (simulation/appState.ts),
                    which converts units with the same helper the engine uses. */}
                {(() => { const hs = headlineStats(state); return [
                  { label: hs.wellbeingLabel, val: hs.wellbeingAvailable ? hs.meanCountryWellbeing.toFixed(1) : 'Unavailable', color: 'text-emerald-600 dark:text-emerald-400', desc: capabilities.conditional ? "Population-weighted illustrative conditional index across the complete modeled roster. Unavailable if any country is outside the mapping scale." : "Mean of country wellbeing indices (0-100), unweighted: every country counts once regardless of population. Not the average person's wellbeing." },
                  { label: 'Global dividend', val: formatUsdPerPerson(hs.globalDividendUsd), color: 'text-amber-600 dark:text-amber-400', desc: "Global dividend this month: USD per person from the global pool, paid equally per capita to all modeled residents. Customer-weighted and HQ-local payments come on top and vary by country." },
                  { label: 'Adoption', val: `${(hs.meanCountryAdoption * 100).toFixed(0)}%`, color: 'text-blue-600 dark:text-blue-400', desc: "Mean of country AI adoption, unweighted: every country counts once regardless of population." },
                  { label: 'Pool', val: formatBillionsUsd(hs.globalPoolBillions), color: 'text-slate-900 dark:text-white', desc: "Global pool this month: contributions routed to equal per-capita distribution. Paid out the same month, not accumulated. Excludes customer-weighted and HQ-local contributions." }
                ]; })().map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-lg flex justify-between items-center shadow-sm">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest flex items-center">
                            {stat.label}
                            <InfoTooltip text={stat.desc} />
                        </div>
                        <div className={`text-sm lg:text-lg font-bold font-mono ${stat.color}`}>{stat.val}</div>
                    </div>
                ))}
              </div>

{!capabilities.conditional && <>
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
                    <InfoTooltip text="Global displacement gap this month: lost labour income not covered by UBI, summed over countries (billions USD per month)." />
                  </div>
                  <div className={`text-sm font-bold font-mono ${state.globalDisplacementGap > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {formatBillionsUsd(millionsToBillionsUsd(state.globalDisplacementGap))}
                  </div>
                </div>
              </div>


</>}
{!capabilities.conditional && <>
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


</>}
              {/* Prisoner's Dilemma Warning */}
              {!capabilities.conditional && gameTheoryState.isInPrisonersDilemma && (
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
                      <div className="mb-3 flex flex-col gap-2 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 border-2 border-blue-400 dark:border-blue-500 px-4 py-3 rounded-xl shadow-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                            <div className="text-sm font-black text-white uppercase tracking-wider">Your Current Simulation</div>
                          </div>
                          <div className="text-xs font-bold text-blue-100 bg-blue-700/50 px-2 py-1 rounded-md">Month {state.month}</div>
                        </div>
                        <div className="text-xs text-blue-50 flex items-center gap-4">
                          <span>Avg Wellbeing: <span className="font-bold text-white">{(state.conditionalSummary ? state.conditionalSummary.value?.toFixed(1) ?? 'Unavailable' : state.averageWellbeing.toFixed(1))}</span></span>
                          <span>Adoption: <span className="font-bold text-white">{(averageAdoption(state) * 100).toFixed(1)}%</span></span>
                        </div>
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
                          selectedArchetype={capabilities.conditional ? null : selectedArchetype}
                        />
                      </div>
                    </div>
                    {/* Right Side - Comparison Scenario */}
                    <div className="flex flex-col h-full">
                      <div className="mb-3 flex flex-col gap-2 bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 border-2 border-purple-400 dark:border-purple-500 px-4 py-3 rounded-xl shadow-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                            <div className="text-sm font-black text-white uppercase tracking-wider">
                              Comparison: {SCENARIO_PRESETS.find(s => s.id === comparisonScenarioId)?.name || 'Alternative'}
                            </div>
                          </div>
                          <div className="text-xs font-bold text-purple-100 bg-purple-700/50 px-2 py-1 rounded-md">Month {comparisonState.month}</div>
                        </div>
                        <div className="text-xs text-purple-50 flex items-center gap-4">
                          <span>Avg Wellbeing: <span className="font-bold text-white">{(comparisonState.conditionalSummary ? comparisonState.conditionalSummary.value?.toFixed(1) ?? 'Unavailable' : comparisonState.averageWellbeing.toFixed(1))}</span></span>
                          <span>Adoption: <span className="font-bold text-white">{(averageAdoption(comparisonState) * 100).toFixed(1)}%</span></span>
                        </div>
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
                          selectedArchetype={capabilities.conditional ? null : selectedArchetype}
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
                    selectedArchetype={capabilities.conditional ? null : selectedArchetype}
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
                            <p className="text-[10px] leading-relaxed opacity-90 mb-3">Press <span className="font-bold text-white bg-white/20 px-1 rounded">PLAY</span> below to begin the simulation. Watch what adoption and transfers do to wellbeing in this model, and compare with the paired no-UBI run on the Charts tab.</p>
                            <button
                                onClick={() => setTourStep(0)}
                                className="w-full py-1.5 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold uppercase hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                Take a Tour
                            </button>
                        </div>
                    </div>
                )}
              </div>

              {/* Archetype Filter */}
              <div hidden={capabilities.conditional} className="flex justify-center shrink-0 mt-2">
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

          {activeTab === 'modelcard' && (
            <div className="h-full overflow-y-auto scrollbar-hide pb-32">
              <ModelCardTab />
            </div>
          )}

          {(labVisited || activeTab === 'lab') && (
            <div hidden={activeTab !== 'lab'} className="h-full overflow-y-auto scrollbar-hide pb-32">
              <LabTab entryRequest={labEntry} onActiveRunChange={publishPolicy} onOpenResultView={openPolicyCharts} />
            </div>
          )}

          {resultFamily === 'world' && !shareError && activeTab === 'futures' && (
            <div className="h-full overflow-y-auto scrollbar-hide pb-32">
              <FuturesTab
                graph={LOCKED_GRAPH}
                interventions={[...LOCKED_INTERVENTIONS, ...customInterventions]}
                importPanel={
                  <InterventionImportPanel
                    graph={LOCKED_GRAPH}
                    onAdd={(iv) => {
                      const next = [...customInterventions.filter(x => x.id !== iv.id), iv];
                      setCustomInterventions(next);
                      saveCustomInterventions(next);
                    }}
                  />
                }
              />
            </div>
          )}

          {resultFamily === 'world' && !shareError && activeTab === 'charts' && (
            <div className="flex flex-col gap-6 lg:gap-8 h-full overflow-y-auto scrollbar-hide pb-32 relative">
              {/* Comparison Mode Info Banner */}
              {comparisonMode && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-300 dark:border-purple-700 rounded-xl p-4 flex items-start gap-3">
                  <Info size={20} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-purple-900 dark:text-purple-200 mb-1">Comparison Mode Active</h3>
                    <p className="text-xs text-purple-700 dark:text-purple-300">
                      Chart comparison is not yet implemented. Switch to the <button onClick={() => setActiveTab('map')} className="font-bold underline hover:text-purple-900 dark:hover:text-purple-100">Map tab</button> to see side-by-side scenario comparison.
                    </p>
                  </div>
                </div>
              )}
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
                  {visibleChartHistory.length === 0 && (
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
                        // Up to the displayed month (history[0] is month 1, so slice(0, month + 1) showed one month too many after a seek).
                        history={visibleChartHistory}
                        pairedHistory={visiblePairedHistory}
                        maxMonth={Math.max(state.month, ...history.map(h => h.month), 10)}
                        selectedCountries={selectedCountries} 
                        allCountries={['Global', ...INITIAL_COUNTRIES.map(c => c.id)].map(id => ({ id, name: id }))}
                        onToggleCountry={(id) => setSelectedCountries(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                        theme={theme}
                    />
                  </div>

                  <div className="h-[300px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                     <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Database size={14} /> Global Pool per Month ($B)
                     </h3>
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData.filter(d => d.month <= state.month)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                            <Area type="monotone" dataKey="fund" stroke="#f59e0b" fillOpacity={1} fill="url(#colorFund)" strokeWidth={2} name="Global pool this month ($B)" isAnimationActive={false} />
                        </AreaChart>
                     </ResponsiveContainer>
                  </div>

                  {!capabilities.conditional && <>
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
                        <LineChart data={chartData.filter(d => d.month <= state.month)} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
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

                  </>}
                  {/* AI Adoption vs Wellbeing Scatter Plot */}
                  <WellbeingScatterPlot
                    key={`scatter-${state.month}`}
                    countryData={state.countryData}
                    month={state.month}
                  />
              </div>
            </div>
          )}

          {resultFamily === 'world' && !shareError && activeTab === 'corporations' && (
            <div className="h-full overflow-y-auto">
              <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Comparison Mode Info Banner */}
                {comparisonMode && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-300 dark:border-purple-700 rounded-xl p-4 flex items-start gap-3">
                    <Info size={20} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-purple-900 dark:text-purple-200 mb-1">Comparison Mode Active</h3>
                      <p className="text-xs text-purple-700 dark:text-purple-300">
                        Corporation comparison is not yet implemented. Switch to the <button onClick={() => setActiveTab('map')} className="font-bold underline hover:text-purple-900 dark:hover:text-purple-100">Map tab</button> to see side-by-side scenario comparison.
                      </p>
                    </div>
                  </div>
                )}
                {/* Game Theory Visualization Section */}
                {!capabilities.conditional && <GameTheoryVisualization
                  gameTheoryState={gameTheoryState}
                  corporations={corporations}
                />}

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

          {resultFamily === 'world' && !shareError && activeTab === 'analysis' && (
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

          {activeTab === 'models' && (
            <div className="p-6">
              <div className="max-w-4xl mx-auto">
                {/* Active model indicator */}
                <div className="mb-6 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Active Model</h2>
                  {activeModelConfig ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">{activeModelConfig.name}</span>
                        <span className="text-slate-500 dark:text-slate-500 ml-2">v{activeModelConfig.metadata.version}</span>
                        <span className="text-slate-600 dark:text-slate-600 ml-2">by {activeModelConfig.metadata.author}</span>
                      </div>
                      <button
                        onClick={clearModelConfig}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded font-medium transition-colors"
                      >
                        Clear & Use Default
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-600 dark:text-slate-400">Using default model (hardcoded equations)</span>
                  )}
                </div>

                {/* Honest status of the custom-model pipeline (P8-T9) */}
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700 rounded-lg text-sm text-blue-900 dark:text-blue-200">
                  <strong>Custom equations run.</strong> Applying a model compiles its five core equations
                  (AI adoption growth, corporation contribution surplus, displacement friction, UBI-to-wellbeing
                  utility, and the monthly wellbeing update) and uses them in place of the built-in formulas for
                  every simulation step - the trajectory you see reflects your model. Two advanced equations
                  (demand-collapse projection and reputation dynamics) are parsed and validated but still use
                  the default logic. The six anchor tests now run against your model's own compiled equations
                  too, so its anchor-test score reflects its own trajectory, not the built-in engine's.
                </div>

                {/* Mode toggle */}
                <div className="flex gap-4 mb-6">
                  <button
                    onClick={() => setModelMode('upload')}
                    className={`px-4 py-2 rounded font-medium transition-all ${
                      modelMode === 'upload'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                    }`}
                  >
                    Upload Model
                  </button>
                  <button
                    onClick={() => setModelMode('edit')}
                    className={`px-4 py-2 rounded font-medium transition-all ${
                      modelMode === 'edit'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                    }`}
                  >
                    Create/Edit Model
                  </button>
                </div>

                {/* Content based on mode */}
                {modelMode === 'upload' && (
                  <ModelUpload
                    onApply={applyModelConfig}
                    onCancel={() => {}}
                    currentModel={activeModelConfig}
                  />
                )}

                {modelMode === 'edit' && (
                  <ModelEditor
                    initialConfig={activeModelConfig}
                    onSave={applyModelConfig}
                    onRun={(config) => {
                      // P8-T11: "Run Simulation" applies the edited model and re-simulates
                      // it live - switch to the map view and start playing so the effect
                      // of the edit is immediately visible.
                      applyModelConfig(config);
                      setActiveTab('map');
                      setIsPlaying(true);
                    }}
                    onCancel={() => setModelMode('upload')}
                    onRunTests={(config) => {
                      // Apply the model so its own equations are what get scored.
                      applyModelConfig(config);
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {resultFamily === 'world' && !shareError && activeTab === 'leaderboard' && (
            <div className="p-6">
              <Leaderboard
                onApplyModel={(model) => {
                  applyModelConfig(model.modelConfig);
                  setActiveTab('map');
                }}
                onViewDetails={(model) => {
                  setViewingModel(model);
                }}
              />
            </div>
          )}

          {resultFamily === 'world' && !shareError && activeTab === 'overview' && (
            <div className="max-w-6xl mx-auto py-8 lg:py-12 flex flex-col items-center justify-center h-full gap-8">
              <div className="text-center space-y-3">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">The Abundance Cycle</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-2xl text-sm">
                  The loop the model is built around: corporations share AI revenue → transfers reach citizens →
                  citizens spend → corporate demand holds up. It is the model's hypothesis, not a demonstrated result;
                  whether the loop closes, and for whom, is what the simulation and its paired no-UBI run test.
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

          {resultFamily === 'world' && !shareError && activeTab === 'equations' && (
            <div className="max-w-4xl mx-auto py-8 lg:py-12 space-y-8">
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Model Equations</h2>
                <p className="text-slate-500 dark:text-slate-400">
                  {equationViewMode === 'simple'
                    ? 'Core mathematical relationships driving the simulation'
                    : 'Complete equation set for peer review and verification'}
                </p>
                <p className="mx-auto max-w-2xl text-left text-xs rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 px-4 py-3">
                  <span className="font-bold">Parts of this page describe an earlier engine.</span> Formulas that use surplus tax, adoption incentive,
                  redistribution rate or market pressure are not what runs today: the built-in engine reads only growth speed, displacement rate,
                  GDP scaling and the optional macro block. The formulas as actually computed, with their evidence, are in the{' '}
                  <button onClick={() => setActiveTab('modelcard')} className="underline underline-offset-2 font-semibold">model card</button>.
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
                    <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-sm font-mono text-slate-900 dark:text-slate-100">
                      effectiveUBI = totalUBI × (1.5 - gini)
                    </code>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">High inequality reduces UBI effectiveness (0.2 gini = 1.3x, 0.6 gini = 0.9x)</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-3">Corruption Leakage</h3>
                    <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-sm font-mono text-slate-900 dark:text-slate-100">
                      localLeakage = localContribution × (1 - governance)
                    </code>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Low governance = more tax dollars lost to corruption</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-3">Direct-to-Wallet Bypass</h3>
                    <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-sm font-mono text-slate-900 dark:text-slate-100">
                      globalUBI = directToWallet ? globalDividend : globalDividend × governance
                    </code>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Blockchain payments bypass local corruption entirely</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-3">Displacement Gap</h3>
                    <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-sm font-mono text-slate-900 dark:text-slate-100">
                      gap = max(0, (monthlyWage × aiAdoption × displacementRate) - totalUBI)
                    </code>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">When lost wages exceed UBI payments, citizens suffer</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-3">Displacement Friction</h3>
                    <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-sm font-mono text-slate-900 dark:text-slate-100">
                      friction = sin(aiAdoption × π) × 40 × (1 - governance)^1.5 × (1 + gini × 0.5)
                    </code>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Mid-transition anxiety peaks at 50% adoption. Power function (1.5) means low-governance countries suffer exponentially more pain. Well-governed democracies buffer transition anxiety through institutions.</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-3">Wellbeing Delta</h3>
                    <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-sm font-mono text-slate-900 dark:text-slate-100">
                      Δwellbeing = (ubiBoost × 0.20) - (displacementFriction × 0.12)
                    </code>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">UBI boost coefficient (0.20) now exceeds friction coefficient (0.12), reflecting that in well-governed economies with functional institutions, UBI should outpace displacement anxiety.</p>
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
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        sigmoidIncentive = 1 / (1 + exp(k × (adoption - mid)))
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">where k = 10, mid = 0.70</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Incentive effectiveness decreases as adoption approaches saturation.</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">1.2 Effective Adoption Incentive</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        effectiveIncentive = adoptionIncentive × sigmoidIncentive
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">where adoptionIncentive = model parameter</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">1.3 Governance Adoption Modifier</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre text-slate-900 dark:text-slate-100">
{`govModifier = {
  1.2 - (adoption × 0.4)     if governance < 0.5  (autocracy)
  0.9 + (governance × 0.3)   if governance ≥ 0.5  (democracy)
}`}
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Autocracies: fast initial adoption, slow later. Democracies: steady sustained growth.</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">1.4 Regional Economic Modifier</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        regionalModifier = 1 + (gdpPerCapita / 100000)
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Wealthier countries adopt AI faster due to infrastructure and capital availability.</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">1.5 Company Join Probability (Discrete Event)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre text-slate-900 dark:text-slate-100">
{`P(join) = aiGrowthRate × regionalModifier × govModifier
         × (1 + effectiveIncentive) × (1 - adoption)

If random() < P(join): add 1-4 companies to companiesJoined`}
                      </code>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">1.6 Continuous Adoption Growth</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre text-slate-900 dark:text-slate-100">
{`growth = aiGrowthRate × regionalModifier × (1 + companiesJoined × 0.02)
adoption(t+1) = min(0.999, adoption(t) + growth × (1 - adoption(t)))`}
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Logistic growth capped at 99.9% to prevent division by zero.</p>
                    </div>
                  </div>

                  {/* Section 2: Revenue and Tax Collection */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg border-b border-slate-200 dark:border-slate-700 pb-2">2. Surplus Generation and Tax Collection</h3>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">2.1 Base Surplus Production</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        baseSurplus = adoption^1.6 × population × (gdpPerCapita / 40)
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Power function (1.6) reflects increasing returns to scale in automation.</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">2.2 Network Effect Multiplier</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        networkEffect = 1 + (adoption × 0.4)
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">AI systems become more productive as adoption increases (data network effects).</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">2.3 Total Surplus</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        totalSurplus = baseSurplus × networkEffect
                      </code>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">2.4 Raw Fund Contribution (Pre-Corruption)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        rawContribution = totalSurplus × corporateTaxRate
                      </code>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">2.5 Corruption Leakage (Local Tax Only)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre text-slate-900 dark:text-slate-100">
{`globalPortion = globalRedistributionRate
localPortion = 1 - globalRedistributionRate

globalContribution = rawContribution × globalPortion
localContribution = rawContribution × localPortion
localLeakage = localContribution × (1 - governance)
effectiveContribution = globalContribution + (localContribution - localLeakage)`}
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Global taxes paid directly to fund (no leakage). Local taxes subject to governance quality.</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">2.6 Global Pool (Monthly)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        globalFund(t) = Σ contribution(t) of corporations using the global strategy   [billions USD]
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Rebuilt every month and paid out the same month; nothing accumulates.</p>
                    </div>
                  </div>

                  {/* Section 3: UBI Distribution */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg border-b border-slate-200 dark:border-slate-700 pb-2">3. UBI Distribution and Effectiveness</h3>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">3.1 Fund Pool Split</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre text-slate-900 dark:text-slate-100">
{`globalPool = globalFund × globalRedistributionRate
localPool = globalFund × (1 - globalRedistributionRate)`}
                      </code>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">3.2 Global Dividend (Equal Per Capita)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        globalDividendPerCapita [USD/person/month] = globalFund [$B] / worldPopulation [millions] × 1000
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Billions of dollars over millions of people is thousands of dollars per person (simulation/units.ts usdPerPerson, used by the engine and the map).</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">3.3 Local Dividend (Population-Weighted)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre text-slate-900 dark:text-slate-100">
{`countryLocalPool = localPool × (population / worldPopulation)
localDividendRaw = countryLocalPool / (population × 10)
localDividend = localDividendRaw × governance`}
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Local delivery subject to governance quality (corruption in distribution)</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">3.4 Direct-to-Wallet Bypass</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre text-slate-900 dark:text-slate-100">
{`globalDividend = {
  globalDividendPerCapita                if directToWallet = true
  globalDividendPerCapita × governance   if directToWallet = false
}`}
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Blockchain/digital identity bypasses corrupt governments entirely</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">3.5 Total UBI Received</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        totalUBI = localDividend + globalDividend
                      </code>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">3.6 Gini Dampening (Inequality Effect)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre text-slate-900 dark:text-slate-100">
{`giniDamper = 1.5 - gini
effectiveUBI = totalUBI × giniDamper`}
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">High inequality (gini = 0.6) → 0.9× effectiveness. Low inequality (gini = 0.2) → 1.3× effectiveness.</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Rationale: In unequal societies, wealthy save UBI; poor face higher prices.</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">3.7 GDP-Weighted Utility Scaling</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre text-slate-900 dark:text-slate-100">
{`logGDP = log₁₀(gdpPerCapita + 1000)
scalingOffset = logGDP - 4
wealthGradient = 1 + (gdpScaling × 0.5 × scalingOffset)
scaledUBI = effectiveUBI × max(0.5, wealthGradient)`}
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Logarithmic scaling: $100 means more to poor than rich (diminishing marginal utility).</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">3.8 UBI Utility Boost (Wellbeing Impact)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre text-slate-900 dark:text-slate-100">
{`utilityScale = gdpPerCapita / 40 + 150
ubiBoost = (scaledUBI / utilityScale) × 120`}
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Converts dollars into wellbeing points (0-100 scale)</p>
                    </div>
                  </div>

                  {/* Section 4: Displacement and Friction */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg border-b border-slate-200 dark:border-slate-700 pb-2">4. Job Displacement and Social Friction</h3>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">4.1 Monthly Wage (Baseline)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        monthlyWage = gdpPerCapita / 12
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Assumes GDP per capita represents average annual income</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">4.2 Lost Wages from Displacement</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        lostWages = monthlyWage × adoption × displacementRate
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">At 100% AI adoption, displacementRate fraction of labor income is lost</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">4.3 Displacement Gap</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        displacementGap = max(0, lostWages - totalUBI)
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Positive gap indicates UBI is insufficient to replace lost income</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">4.4 Base Friction (Governance Buffering)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        baseFriction = 40 × (1 - governance)^1.5 × (1 + gini × 0.5)
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Power function (1.5) means low-governance countries feel exponentially more pain</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Well-governed democracies buffer transitions via institutions, retraining, safety nets</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">4.5 Displacement Friction (Transition Anxiety)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        displacementFriction = sin(adoption × π) × baseFriction
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Sine function peaks at 50% adoption (mid-transition chaos)</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">At 0% and 100% adoption, friction is minimal (stability)</p>
                    </div>
                  </div>

                  {/* Section 5: Wellbeing Calculation */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg border-b border-slate-200 dark:border-slate-700 pb-2">5. Wellbeing Calculation</h3>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">5.1 Base Wellbeing Update</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        wellbeingBase = wellbeing(t) + (ubiBoost × 0.20) - (displacementFriction × 0.12)
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Coefficients: α = 0.20 (UBI boost), β = 0.12 (friction)</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Rebalanced: UBI now outpaces friction in well-governed economies</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">5.2 Crisis Detection and Penalty</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre text-slate-900 dark:text-slate-100">
{`if displacementGap > monthlyWage × 0.3:
  crisisPenalty = min(5, (displacementGap / monthlyWage) × 10)
  wellbeingBase -= crisisPenalty
  countriesInCrisis += 1`}
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Penalty capped at 5 points: societies adapt via informal economies, family networks</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">5.3 Subsistence Floor Bonuses</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre text-slate-900 dark:text-slate-100">
{`subsistenceFloor = gdpPerCapita / 25

if adoption > 0.60 and totalUBI < subsistenceFloor:
  wellbeingBase -= 1.5
else if totalUBI > subsistenceFloor × 2.5:
  wellbeingBase += 2.0`}
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Penalty: High automation without subsistence UBI = severe hardship</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Bonus: UBI &gt; 2.5× subsistence = thriving (nutrition, education, healthcare access)</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">5.4 Final Wellbeing (Bounded)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        wellbeing(t+1) = max(1, min(100, wellbeingBase))
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Wellbeing bounded to [1, 100] scale</p>
                    </div>
                  </div>

                  {/* Section 6: Paired counterfactual (review 2026-09-14, finding 2) */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg border-b border-slate-200 dark:border-slate-700 pb-2">6. Paired Counterfactual (Same Model, No Corporate UBI)</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                      The dashed "No UBI" lines in Charts come from a second run of the same model, not from separate equations.
                    </p>

                    <div>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono whitespace-pre text-slate-900 dark:text-slate-100 overflow-x-auto">
{`pairedRun(0)   = mainRun(0)                      same countries, corporations, model, equations
contributionRate_c(t) = 0  for every corporation c and month t
pairedRun(t+1) = step(pairedRun(t))              the engine used for the main run
effect(t)      = wellbeing_main(t) - wellbeing_paired(t)`}
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                        Both runs advance, seek and reset together; edits to countries and corporations reach both, except contribution rates.
                        With every contribution at 0 the two runs are identical. An earlier version used a separate "shadow" formula with slower adoption,
                        90% wage loss and extra friction, which showed a large gap even when no UBI was paid; it has been removed.
                      </p>
                    </div>
                  </div>

                  {/* Section 7: Global Aggregates */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg border-b border-slate-200 dark:border-slate-700 pb-2">7. Global Aggregate Metrics</h3>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">7.1 Average Global Wellbeing</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        averageWellbeing = Σ(wellbeing) / numberOfCountries
                      </code>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">7.2 Global Displacement Gap</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        globalDisplacementGap = Σ(displacementGap × population)
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Total aggregate lost wages minus UBI across all countries</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">7.3 Total Corruption Leakage (Monthly)</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        corruptionLeakage = Σ(localLeakage)
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Tax dollars lost to corrupt governments each month</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">7.4 Countries in Crisis Count</h4>
                      <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100">
                        countriesInCrisis = count(displacementGap &gt; monthlyWage × 0.3)
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Number of countries where UBI insufficient to cover job losses</p>
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
                     <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-6 lg:p-8 rounded-[2rem] shadow-sm">
                        <h3 className="text-amber-900 dark:text-amber-200 text-sm font-bold uppercase tracking-widest mb-3">Model card: what the default model is, and is not</h3>
                        <p className="text-sm text-amber-900/90 dark:text-amber-100/90">
                          The default world model is a deterministic, money-conserving mechanism model whose numbers are assumptions: 13 of its 15
                          relationships have no source. It is an <span className="font-semibold">illustrative</span> default, not a reviewed one. The card lists
                          every lever, what the engine actually reads, the evidence for each relationship, how outputs respond to small nudges, and the open
                          failures (the UBI-to-wellbeing coefficient is not calibrated; lost wages are permanent by assumption).
                        </p>
                        <button onClick={() => setActiveTab('modelcard')} className="inline-block mt-3 text-sm font-bold text-amber-900 dark:text-amber-200 underline underline-offset-2">Read the model card</button>
                     </div>
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
          </div>
        </section>
      </main>

      <footer hidden={!showWorldControls} className="guided-world-footer px-4 lg:px-6 py-3 lg:py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        {/* A5: a custom model that does not compile blocks playback and says so, here, next to
            the controls it disables. The built-in engine is never used in its place. */}
        {pendingAutosave && (
          <div role="status" className="mx-4 lg:mx-6 mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            <span className="font-semibold">Auto-saved simulation found</span>
            <span className="text-amber-800/80 dark:text-amber-200/80">from {new Date(pendingAutosave.timestamp).toLocaleString()}, month {pendingAutosave.month}.</span>
            <button type="button" onClick={restoreAutosave} className="min-h-9 rounded-md bg-amber-600 px-3 py-1 font-bold uppercase text-white hover:bg-amber-700">Restore</button>
            <button type="button" onClick={discardAutosave} className="min-h-9 rounded-md border border-amber-400 px-3 py-1 font-bold uppercase hover:bg-amber-100 dark:hover:bg-amber-900/40">Discard</button>
          </div>
        )}
        {capabilities.conditional && <p className="p-3 text-sm">Conditional wellbeing index: model-implied level under this month’s scenario conditions. Adaptation timing, transfer-to-macro feedback, game theory and net welfare are unestimated. Transfers use a hypothetical constant-2015 USD modeled source pool; expenses and ownership effects are unestimated.</p>}
        {capabilities.equationIssue && <p role="alert">{capabilities.equationIssue}</p>}
        {referenceEnded && (
          <div role="status" className="mx-4 lg:mx-6 mb-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100">
            <span className="font-semibold">End of the US reference (January 2030).</span> The United States follows the faithful port of Korinek et al. (2026) only to its reporting date; nothing after it is modelled, so the run stops here. Choose another preset to run longer.
          </div>
        )}
        <EquationErrorBanner
          modelName={activeModelConfig?.name || 'custom model'}
          errors={equationErrors}
          onClear={clearModelConfig}
        />
        <SimulationControls isPlaying={isPlaying} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onReset={handleReset} onStep={stepSimulation} speed={speed} setSpeed={setSpeed} month={state.month} maxMonth={history.length > 0 ? Math.max(...history.map(h => h.month)) : state.month} onSeek={handleSeek} disabled={!canStep} disabledReason={capabilities.equationIssue || comparisonCapabilities.equationIssue || (comparisonEnded ? 'Comparison reference ends at month 60.' : undefined) || (referenceEnded ? 'The US reference path (Korinek et al. 2026) ends in January 2030; later months are not modelled.' : `Custom model "${activeModelConfig?.name || ''}" has ${equationErrors.length} equation errors`)} />
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

      {/* Model Detail Modal (P9-T10) */}
      {viewingModel && (
        <ModelDetail
          model={viewingModel}
          onClose={() => setViewingModel(null)}
          onApply={(model) => {
            applyModelConfig(model.modelConfig);
            setViewingModel(null);
            setActiveTab('map');
          }}
          onRate={(modelId, rating) => {
            rateModel(modelId, rating);
          }}
        />
      )}
    </div>
  );
};

export default App;

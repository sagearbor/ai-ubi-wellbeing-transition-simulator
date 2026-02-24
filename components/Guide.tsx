import React, { useState } from 'react';
import { ArrowRight, Activity, Globe, Landmark, Users, Wallet, ShieldCheck, AlertTriangle } from 'lucide-react';

const EquationBlock = ({ title, latex, desc }: { title: string, latex: string, desc: string }) => (
  <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">{title}</h4>
    <div className="font-mono text-sm md:text-base bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 mb-2 text-center overflow-x-auto">
      {latex}
    </div>
    <p className="text-xs text-slate-600 dark:text-slate-400 italic">{desc}</p>
  </div>
);

const Guide: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'flow' | 'math'>('flow');

  return (
    <div className="h-full flex flex-col p-4 max-w-5xl mx-auto">
        <div className="flex gap-2 mb-6 justify-center">
            <button onClick={() => setActiveSection('flow')} className={`px-4 py-2 rounded-lg font-bold text-xs uppercase transition-colors ${activeSection === 'flow' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>System Flow</button>
            <button onClick={() => setActiveSection('math')} className={`px-4 py-2 rounded-lg font-bold text-xs uppercase transition-colors ${activeSection === 'math' ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>Equations</button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 relative shadow-inner p-4">
            {activeSection === 'flow' && (
                <div className="flex flex-col items-center gap-8 py-8 relative">
                    {/* Level 1: Production */}
                    <div className="flex flex-col items-center">
                         <div className="p-4 bg-slate-800 text-white rounded-xl shadow-xl flex flex-col items-center w-48 border border-slate-700">
                             <Activity className="mb-2 text-blue-400"/>
                             <div className="font-bold">AI Surplus</div>
                             <div className="text-[10px] text-slate-400">Total Production</div>
                         </div>
                         <div className="h-8 w-0.5 bg-slate-300 dark:bg-slate-700 my-2 relative">
                             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 px-2 text-[10px] text-slate-500">TAX</div>
                         </div>
                    </div>

                    {/* Level 2: The Split */}
                    <div className="flex w-full max-w-2xl justify-between relative">
                        {/* Divider Line */}
                        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-dashed border-l-2 border-slate-200 dark:border-slate-800 -z-10"></div>
                        
                        {/* Left: Local */}
                        <div className="flex flex-col items-center w-1/2 pr-4">
                            <div className="mb-2 text-xs font-bold text-rose-500 uppercase tracking-widest">Legacy Path</div>
                            <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl w-full text-center relative">
                                <Landmark className="mx-auto mb-2 text-rose-500"/>
                                <div className="font-bold text-rose-700 dark:text-rose-300">Local Government</div>
                                <div className="text-[10px] text-rose-500 mt-1">Funds subject to Corruption</div>
                                
                                <div className="absolute -right-3 top-1/2 -translate-y-1/2 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                                    LEAKAGE
                                </div>
                            </div>
                            <div className="h-12 w-0.5 bg-rose-200 dark:bg-rose-800 my-2"></div>
                            <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg w-3/4 text-center">
                                <div className="text-xs font-bold">Local UBI</div>
                                <div className="text-[9px] text-slate-500">Diminished by graft</div>
                            </div>
                        </div>

                        {/* Right: Global */}
                        <div className="flex flex-col items-center w-1/2 pl-4">
                            <div className="mb-2 text-xs font-bold text-emerald-500 uppercase tracking-widest">Modern Path</div>
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl w-full text-center relative">
                                <Globe className="mx-auto mb-2 text-emerald-500"/>
                                <div className="font-bold text-emerald-700 dark:text-emerald-300">Global Fund</div>
                                <div className="text-[10px] text-emerald-500 mt-1">Blockchain Verified</div>
                                
                                <div className="absolute -left-3 top-1/2 -translate-y-1/2 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    100% SAFE
                                </div>
                            </div>
                            <div className="h-12 w-0.5 bg-emerald-200 dark:bg-emerald-800 my-2"></div>
                            <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg w-3/4 text-center shadow-lg shadow-emerald-500/10">
                                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Direct Dividend</div>
                                <div className="text-[9px] text-slate-500">Bypasses all intermediaries</div>
                            </div>
                        </div>
                    </div>

                    {/* Level 3: Citizen */}
                    <div className="w-full max-w-lg mt-8 pt-8 border-t border-slate-200 dark:border-slate-700">
                        <div className="p-6 bg-slate-800 text-white rounded-2xl flex items-center justify-between shadow-2xl">
                             <div className="flex items-center gap-4">
                                 <Users size={32} className="text-sky-400"/>
                                 <div>
                                     <div className="font-bold text-lg">Citizen Outcome</div>
                                     <div className="text-xs text-slate-400">Total Wellbeing Score</div>
                                 </div>
                             </div>
                             <div className="text-right">
                                 <div className="text-2xl font-mono font-bold text-emerald-400">INPUT</div>
                                 <div className="text-[10px] opacity-70">WAGE + LOCAL + GLOBAL</div>
                             </div>
                        </div>
                    </div>
                </div>
            )}

            {activeSection === 'math' && (
                <div className="max-w-2xl mx-auto p-4">
                    <EquationBlock 
                        title="1. Surplus Generation" 
                        latex="S = P \times G \times ( (1 + A^{1.8} \times 10) - 1 )"
                        desc="Surplus (S) is derived from Population (P) and GDP Base (G), scaled exponentially by AI Adoption (A). Note that only the efficiency gain above 1.0 is taxed."
                    />
                     <EquationBlock 
                        title="2. The Corruption Filter" 
                        latex="T_{net} = (S \times Rate) \times (1 - Corruption)"
                        desc="Tax revenue is lost to graft before it can be distributed. However, the Global Share bypasses this filter in the 2.0 Direct-to-Wallet update."
                    />
                    <EquationBlock 
                        title="3. Income & Demand" 
                        latex="I = W_{labor} + UBI_{local} + UBI_{global}"
                        desc="Total citizen income is the sum of remaining wages (which shrink as AI grows) and the two UBI streams."
                    />
                    <EquationBlock 
                        title="4. Wellbeing Score" 
                        latex="W = 100 \times \frac{Demand}{Demand + Subsistence_{adjusted}}"
                        desc="Wellbeing is a saturation curve. It requires exponentially more money to reach 100, but drops sharply if income falls below the subsistence floor."
                    />
                </div>
            )}
        </div>
    </div>
  );
};

export default Guide;

import React from 'react';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';

interface Props {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onStep: () => void;
  speed: number;
  setSpeed: (s: number) => void;
  month: number;
  maxMonth: number;
  onSeek: (m: number) => void;
}

const SimulationControls: React.FC<Props> = ({ 
  isPlaying, onPlay, onPause, onReset, onStep, speed, setSpeed, month, maxMonth, onSeek 
}) => {
  
  // Format month index to "Mon YYYY" starting from Jan 2025
  const formatDate = (m: number) => {
    const startYear = 2025;
    const date = new Date(startYear, m, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-800/50 border border-slate-700 rounded-xl backdrop-blur">
      <div className="w-full flex items-center gap-4">
        <span className="text-[10px] font-mono text-slate-500 w-16">TIMELINE</span>
        <input 
          type="range"
          min={0}
          max={maxMonth}
          value={month}
          onChange={(e) => onSeek(parseInt(e.target.value))}
          className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
        />
        <span className="text-[10px] font-mono text-sky-400 w-20 text-right whitespace-nowrap">{formatDate(month)}</span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={onReset}
            className="p-2 rounded-full hover:bg-slate-700 text-slate-400 transition-colors"
            title="Reset Simulation"
          >
            <RotateCcw size={20} />
          </button>
          
          <div className="h-8 w-px bg-slate-700" />
          
          <button 
            onClick={isPlaying ? onPause : onPlay}
            className="p-3 rounded-full bg-sky-500 hover:bg-sky-400 text-white transition-all shadow-lg shadow-sky-500/20 active:scale-95"
          >
            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
          </button>
          
          <button 
            onClick={onStep}
            className="p-2 rounded-full hover:bg-slate-700 text-slate-400 transition-colors"
            title="Step Forward"
          >
            <SkipForward size={20} />
          </button>
        </div>

        <div className="flex flex-col items-center sm:items-end">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 uppercase tracking-widest">Speed</span>
            <div className="flex gap-1">
              {[1, 2, 5].map(s => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-0.5 text-[10px] rounded border ${speed === s ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-600 text-slate-400 hover:border-slate-400'}`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationControls;

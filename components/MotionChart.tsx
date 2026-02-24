import React, { useMemo, useState, useRef } from 'react';
import { Layers, Rotate3D, TrendingUp, Maximize2 } from 'lucide-react';
import { HistoryPoint } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label } from 'recharts';

interface MotionChartProps {
  history: HistoryPoint[];
  maxMonth: number;
  selectedCountries: string[];
  allCountries: { id: string; name: string }[];
  onToggleCountry: (id: string) => void;
  theme: 'dark' | 'light';
}

const formatYear = (monthIndex: number) => {
    const startYear = 2025;
    const year = startYear + Math.floor(monthIndex / 12);
    const month = monthIndex % 12;
    if (month === 0) return `${year}`;
    return '';
};

// Custom 3D Projection Engine for Scatter/Line
const project3D = (x: number, y: number, z: number, angle: number, width: number, height: number) => {
    const rad = angle * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    // Rotate around Y axis
    const rotX = x * cos - z * sin;
    const rotZ = x * sin + z * cos;
    
    // Simple perspective
    const fov = 400;
    const zOffset = rotZ + 400; // Camera distance
    const scale = zOffset > 0 ? fov / zOffset : 0;
    
    return {
        x: width/2 + rotX * scale,
        y: height/2 + y * scale,
        scale: scale,
        z: rotZ // for depth sorting
    };
};

const MotionChart: React.FC<MotionChartProps> = ({ 
    history, maxMonth, selectedCountries, allCountries, onToggleCountry, theme 
}) => {
  const [is3D, setIs3D] = useState(false);
  const [rotation, setRotation] = useState(25);
  
  // Data prep for 2D Chart
  const lineData = useMemo(() => {
    return history.map(point => {
      const data: any = { 
          month: point.month, 
          Shadow_Global: point.state.shadowAverageWellbeing
      };
      Object.keys(point.state.countryData).forEach(id => {
        data[`Wellbeing_${id}`] = point.state.countryData[id].wellbeing;
      });
      return data;
    });
  }, [history]);

  // Data prep for 3D Chart
  // We plot: X=Adoption, Y=Wellbeing, Z=Time
  const points3D = useMemo(() => {
     if (!is3D || history.length === 0) return [];
     
     const pts: any[] = [];
     const ids = ['Global', ...selectedCountries];
     
     // Sample history to avoid performance kill
     const step = Math.ceil(history.length / 50); 
     
     history.forEach((h, i) => {
         if (i % step !== 0 && i !== history.length -1) return;
         
         ids.forEach(id => {
             const stat = id === 'Global' ? { aiAdoption: 0.5, wellbeing: h.state.averageWellbeing } : h.state.countryData[id];
             if (!stat) return;
             
             // Normalize to -150 to 150 coordinate space
             const x = (stat.aiAdoption * 300) - 150; // Adoption Left-Right
             const y = -((stat.wellbeing / 100) * 300) + 150; // Wellbeing Up-Down (inverted Y)
             const z = ((h.month / maxMonth) * 400) - 200; // Time Front-Back
             
             pts.push({
                 id,
                 x, y, z,
                 realX: stat.aiAdoption,
                 realY: stat.wellbeing,
                 month: h.month,
                 color: id === 'Global' ? '#10b981' : `hsl(${(id.charCodeAt(0) * 50) % 360}, 70%, 60%)`
             });
         });
     });
     return pts;
  }, [history, is3D, selectedCountries, maxMonth]);

  return (
    <div className="flex flex-col gap-4 h-full relative">
      <div className="flex justify-between items-center mb-2 z-10">
         <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {is3D ? <Rotate3D size={20} className="text-emerald-500"/> : <TrendingUp size={20} className="text-blue-500"/>}
            {is3D ? '3D Trajectory (Adoption vs Wellbeing vs Time)' : 'Wellbeing Timeline'}
         </h3>
         <button 
            onClick={() => setIs3D(!is3D)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all border ${is3D ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'}`}
         >
            {is3D ? 'Switch to 2D' : 'Switch to 3D'}
         </button>
      </div>

      <div className="flex-1 min-h-0 relative overflow-hidden">
        {!is3D ? (
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e2e8f0' : '#1e293b'} />
                    <XAxis 
                        dataKey="month" 
                        type="number" 
                        domain={[0, maxMonth || 'auto']} 
                        stroke={theme === 'light' ? '#64748b' : '#94a3b8'} 
                        fontSize={10}
                        tickFormatter={(val) => formatYear(val)}
                        interval="preserveStartEnd"
                    />
                    <YAxis domain={[0, 100]} stroke={theme === 'light' ? '#64748b' : '#94a3b8'} fontSize={10} />
                    <Tooltip 
                        contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#0f172a', borderColor: theme === 'light' ? '#e2e8f0' : '#1e293b' }}
                        labelFormatter={(label) => `Year: ${formatYear(label)}`}
                    />
                    <Line type="monotone" dataKey="Shadow_Global" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Baseline" />
                    {selectedCountries.map((id, idx) => {
                        const hue = (id.charCodeAt(0) * 50) % 360;
                        return (
                            <Line key={id} type="monotone" dataKey={`Wellbeing_${id}`} stroke={`hsl(${hue}, 70%, 60%)`} strokeWidth={3} dot={false} name={id} />
                        );
                    })}
                </LineChart>
            </ResponsiveContainer>
        ) : (
            <div className="w-full h-full relative cursor-move bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-200 dark:border-slate-800"
                 onMouseMove={(e) => {
                     if (e.buttons === 1) {
                         setRotation(prev => prev + e.movementX * 0.5);
                     }
                 }}
            >
                <svg width="100%" height="100%" viewBox="0 0 800 400" className="pointer-events-none">
                    {/* Render Axes/Box */}
                    {(() => {
                        const corners = [
                            {x: -150, y: -150, z: -200}, {x: 150, y: -150, z: -200},
                            {x: 150, y: 150, z: -200}, {x: -150, y: 150, z: -200},
                            {x: -150, y: -150, z: 200}, {x: 150, y: -150, z: 200},
                            {x: 150, y: 150, z: 200}, {x: -150, y: 150, z: 200}
                        ].map(p => project3D(p.x, p.y, p.z, rotation, 800, 400));
                        
                        return (
                            <g stroke="#94a3b8" strokeWidth="1" strokeOpacity="0.3">
                                {/* Back Face */}
                                <line x1={corners[0].x} y1={corners[0].y} x2={corners[1].x} y2={corners[1].y} />
                                <line x1={corners[1].x} y1={corners[1].y} x2={corners[2].x} y2={corners[2].y} />
                                <line x1={corners[2].x} y1={corners[2].y} x2={corners[3].x} y2={corners[3].y} />
                                <line x1={corners[3].x} y1={corners[3].y} x2={corners[0].x} y2={corners[0].y} />
                                {/* Front Face */}
                                <line x1={corners[4].x} y1={corners[4].y} x2={corners[5].x} y2={corners[5].y} />
                                <line x1={corners[5].x} y1={corners[5].y} x2={corners[6].x} y2={corners[6].y} />
                                <line x1={corners[6].x} y1={corners[6].y} x2={corners[7].x} y2={corners[7].y} />
                                <line x1={corners[7].x} y1={corners[7].y} x2={corners[4].x} y2={corners[4].y} />
                                {/* Connectors */}
                                <line x1={corners[0].x} y1={corners[0].y} x2={corners[4].x} y2={corners[4].y} />
                                <line x1={corners[1].x} y1={corners[1].y} x2={corners[5].x} y2={corners[5].y} />
                                <line x1={corners[2].x} y1={corners[2].y} x2={corners[6].x} y2={corners[6].y} />
                                <line x1={corners[3].x} y1={corners[3].y} x2={corners[7].x} y2={corners[7].y} />
                            </g>
                        );
                    })()}

                    {/* Points */}
                    {points3D.map((p, i) => {
                        const proj = project3D(p.x, p.y, p.z, rotation, 800, 400);
                        return (
                            <circle 
                                key={i} 
                                cx={proj.x} 
                                cy={proj.y} 
                                r={3 * proj.scale} 
                                fill={p.color} 
                                opacity={0.8}
                            />
                        );
                    })}
                    
                    {/* Connecting Lines for Countries */}
                    {selectedCountries.map(id => {
                        const countryPoints = points3D.filter(p => p.id === id);
                        if(countryPoints.length < 2) return null;
                        
                        let d = "";
                        countryPoints.forEach((p, i) => {
                            const proj = project3D(p.x, p.y, p.z, rotation, 800, 400);
                            d += (i===0 ? "M" : "L") + `${proj.x},${proj.y} `;
                        });
                        
                        return (
                            <path 
                                key={`line-${id}`}
                                d={d}
                                stroke={countryPoints[0].color}
                                strokeWidth={2}
                                fill="none"
                                opacity={0.6}
                            />
                        );
                    })}
                </svg>
                <div className="absolute bottom-2 left-2 text-[10px] text-slate-500 font-mono">
                    X: Adoption | Y: Wellbeing | Z: Time (Year) <br/> Drag to Rotate
                </div>
            </div>
        )}
      </div>

      <div className="shrink-0 z-10">
         <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto scrollbar-hide">
            {allCountries.map(c => (
                <button
                    key={c.id}
                    onClick={() => onToggleCountry(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${selectedCountries.includes(c.id) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400'}`}
                >
                    {c.id}
                </button>
            ))}
         </div>
      </div>
    </div>
  );
};

export default MotionChart;
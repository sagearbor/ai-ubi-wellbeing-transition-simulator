
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label } from 'recharts';
import { Box, Layers, Rotate3D, Move, Search, Type, Minus, Plus } from 'lucide-react';
import { HistoryPoint, CountryStats } from '../types';

interface MotionChartProps {
  history: HistoryPoint[];
  maxMonth: number;
  selectedCountries: string[];
  allCountries: { id: string; name: string }[];
  onToggleCountry: (id: string) => void;
  theme: 'dark' | 'light';
}

const formatDate = (monthIndex: number) => {
    const date = new Date(2025, monthIndex, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

const ThreeDChart: React.FC<{ 
  data: any[], 
  selectedCountries: string[], 
  theme: 'dark' | 'light',
  maxMonth: number,
  baseFontSize: number
}> = ({ data, selectedCountries, theme, maxMonth, baseFontSize }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Interaction State
  const [rotation, setRotation] = useState({ x: 0.2, y: -0.5 });
  const [zoom, setZoom] = useState(1.0);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // Event Handlers
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    lastMouse.current = { x: clientX, y: clientY };
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const deltaX = clientX - lastMouse.current.x;
    const deltaY = clientY - lastMouse.current.y;
    
    setRotation(prev => ({
      x: Math.max(-Math.PI/2, Math.min(Math.PI/2, prev.x + deltaY * 0.01)), // Clamp vertical
      y: prev.y + deltaX * 0.01
    }));
    
    lastMouse.current = { x: clientX, y: clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation(); 
    const delta = e.deltaY * -0.001; 
    setZoom(z => Math.max(0.1, Math.min(6, z + delta)));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      
      ctx.clearRect(0, 0, width, height);

      // --- Smart "Cinematic" Rotation Logic ---
      
      // 1. Time Component: Steady "Flyover" Orbit
      // Rotates more aggressively as time passes to show different angles of the growing structure
      const timeRotationY = data.length * 0.02; 
      
      // 2. Data Reactivity: "Swing to see Depth"
      // Calculate global average adoption (Z-depth)
      let globalAdoption = 0;
      if (data.length > 0) {
        const last = data[data.length - 1];
        if (last && typeof last.Adoption_Global === 'number') {
            globalAdoption = last.Adoption_Global;
        }
      }
      
      // As adoption (Z) grows (0 -> 100), we rotate an extra ~90 degrees (PI/2) 
      // This forces the view from "Front" (2D) to "Side" (3D) to reveal the Z-axis separation.
      const adoptionRotationY = (globalAdoption / 100) * (Math.PI / 1.8);

      // 3. Vertical Tilt (X-Axis) based on data
      // When adoption is high, tilt up slightly to see the "floor plan" better
      const adoptionTiltX = (globalAdoption / 100) * 0.3;
      // Gentle sine wave bob for liveness
      const timeBobX = Math.sin(data.length * 0.05) * 0.1;

      // Combine Manual + Auto
      // We subtract the auto-rotations from Y so it spins "around" the object naturally
      const effectiveRotationY = rotation.y - timeRotationY - adoptionRotationY;
      const effectiveRotationX = rotation.x + adoptionTiltX + timeBobX;


      // 3D Projection
      const project = (x: number, y: number, z: number) => {
        const scale = Math.min(width, height) * 0.35 * zoom;
        
        // Rotate Y 
        const x1 = x * Math.cos(effectiveRotationY) - z * Math.sin(effectiveRotationY);
        const z1 = x * Math.sin(effectiveRotationY) + z * Math.cos(effectiveRotationY);
        
        // Rotate X 
        const y2 = y * Math.cos(effectiveRotationX) - z1 * Math.sin(effectiveRotationX);
        const z2 = y * Math.sin(effectiveRotationX) + z1 * Math.cos(effectiveRotationX);
        
        // Perspective
        const depth = 4;
        const f = depth / (depth - z2 * 0.5); 
        
        return {
          x: centerX + x1 * scale * f,
          y: centerY - y2 * scale * f
        };
      };

      const drawLine = (p1: {x:number, y:number, z:number}, p2: {x:number, y:number, z:number}, color: string, width = 1, dashed = false) => {
        const start = project(p1.x, p1.y, p1.z);
        const end = project(p2.x, p2.y, p2.z);
        ctx.beginPath();
        if (dashed) ctx.setLineDash([2, 4]);
        else ctx.setLineDash([]);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
        ctx.setLineDash([]);
      };

      const drawText = (text: string, p: {x:number, y:number, z:number}, color: string, fontMultiplier = 1) => {
          const loc = project(p.x, p.y, p.z);
          ctx.fillStyle = color;
          ctx.font = `bold ${Math.round(baseFontSize * fontMultiplier)}px sans-serif`;
          ctx.fillText(text, loc.x, loc.y);
      };

      // Colors
      const axisColor = theme === 'light' ? '#64748b' : '#94a3b8'; // Higher contrast
      const gridColor = theme === 'light' ? '#e2e8f0' : '#1e293b';
      const textColor = theme === 'light' ? '#0f172a' : '#f8fafc';

      // --- Draw Axes Box ---
      // Bounds: -1 to 1 on all axes
      
      // Back Grid
      drawLine({x:-1, y:-1, z:1}, {x:1, y:-1, z:1}, gridColor);
      drawLine({x:-1, y:1, z:1}, {x:1, y:1, z:1}, gridColor);
      drawLine({x:-1, y:-1, z:1}, {x:-1, y:1, z:1}, gridColor);
      drawLine({x:1, y:-1, z:1}, {x:1, y:1, z:1}, gridColor);

      // Main Axes (Origin is roughly bottom-left-front)
      // X-Axis (Time)
      drawLine({x:-1, y:-1, z:-1}, {x:1, y:-1, z:-1}, axisColor, 2); 
      // Y-Axis (Wellbeing)
      drawLine({x:-1, y:-1, z:-1}, {x:-1, y:1, z:-1}, axisColor, 2);
      // Z-Axis (Adoption)
      drawLine({x:1, y:-1, z:-1}, {x:1, y:-1, z:1}, axisColor, 2);

      // Connectors to complete the box visually (lighter)
      drawLine({x:-1, y:1, z:-1}, {x:1, y:1, z:-1}, gridColor); // Top Front
      drawLine({x:1, y:1, z:-1}, {x:1, y:1, z:1}, gridColor);   // Top Right
      drawLine({x:-1, y:-1, z:-1}, {x:-1, y:-1, z:1}, gridColor); // Bottom Left depth

      // Labels - Scaled up slightly by default
      drawText("TIME (X)", {x:0, y:-1.2, z:-1}, textColor, 1.2);
      drawText("WELLBEING (Y)", {x:-1.1, y:0, z:-1}, textColor, 1.2);
      drawText("ADOPTION (Z)", {x:1.1, y:-1.1, z:0}, textColor, 1.2);

      // Tick Marks
      // Time (Start / End)
      drawText("Start", {x:-1, y:-1.1, z:-1}, axisColor);
      drawText("Now", {x:1, y:-1.1, z:-1}, axisColor);
      // Wellbeing (0 / 100)
      drawText("0", {x:-1.1, y:-1, z:-1}, axisColor);
      drawText("100", {x:-1.1, y:1, z:-1}, axisColor);

      // --- Data Lines ---
      selectedCountries.forEach((id, idx) => {
        const hue = (idx * 137) % 360;
        const color = `hsl(${hue}, 70%, 60%)`;
        
        ctx.beginPath();
        let first = true;

        data.forEach((point) => {
            const nx = (point.month / (maxMonth || 1)) * 2 - 1;
            const valY = point[`Wellbeing_${id}`];
            if (valY === undefined) return;
            const ny = (valY / 100) * 2 - 1;
            const valZ = point[`Adoption_${id}`];
            const nz = (valZ / 100) * 2 - 1;

            const coords = project(nx, ny, nz);
            
            if (first) {
                ctx.moveTo(coords.x, coords.y);
                first = false;
            } else {
                ctx.lineTo(coords.x, coords.y);
            }
        });

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw Head Point
        if (data.length > 0) {
             const last = data[data.length - 1];
             const valY = last[`Wellbeing_${id}`];
             const valZ = last[`Adoption_${id}`];
             if(valY !== undefined) {
                 const nx = (last.month / (maxMonth || 1)) * 2 - 1;
                 const ny = (valY / 100) * 2 - 1;
                 const nz = (valZ / 100) * 2 - 1;
                 const coords = project(nx, ny, nz);
                 
                 ctx.fillStyle = color;
                 ctx.beginPath();
                 ctx.arc(coords.x, coords.y, 6, 0, Math.PI * 2);
                 ctx.fill();
                 ctx.strokeStyle = '#fff';
                 ctx.lineWidth = 1;
                 ctx.stroke();
                 
                 // Country Label
                 drawText(id, { x: nx, y: ny + 0.1, z: nz }, textColor);
             }
        }
      });
      
      animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [data, selectedCountries, theme, maxMonth, rotation, zoom, baseFontSize]);

  return (
    <canvas 
        ref={canvasRef} 
        width={800} 
        height={500}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full object-contain cursor-move touch-none"
    />
  );
};

const MotionChart: React.FC<MotionChartProps> = ({
    history, maxMonth, selectedCountries, allCountries, onToggleCountry, theme
}) => {
  const [is3D, setIs3D] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [showShadow, setShowShadow] = useState(true);

  // Transform data for charts including shadow data
  const chartData = useMemo(() => {
    return history.map(point => {
      const data: any = {
          month: point.month,
      };

      // Global - Main simulation
      data['Wellbeing_Global'] = point.state.averageWellbeing;
      const globalAdoption = (Object.values(point.state.countryData) as CountryStats[]).reduce((acc, curr) => acc + curr.aiAdoption, 0) / Object.keys(point.state.countryData).length * 100;
      data['Adoption_Global'] = globalAdoption;

      // Shadow Global - No intervention baseline
      if (point.state.shadowCountryData) {
        const shadowWellbeings = Object.values(point.state.shadowCountryData) as CountryStats[];
        const shadowAvg = shadowWellbeings.reduce((acc, curr) => acc + curr.wellbeing, 0) / shadowWellbeings.length;
        data['Shadow_Global'] = shadowAvg;
      }

      // Countries - Main + Shadow
      Object.keys(point.state.countryData).forEach(id => {
        data[`Wellbeing_${id}`] = point.state.countryData[id].wellbeing;
        data[`Adoption_${id}`] = point.state.countryData[id].aiAdoption * 100;

        // Shadow per country
        if (point.state.shadowCountryData && point.state.shadowCountryData[id]) {
          data[`Shadow_${id}`] = point.state.shadowCountryData[id].wellbeing;
        }
      });
      return data;
    });
  }, [history]);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex justify-between items-center mb-2">
         <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {is3D ? <Box size={20} className="text-blue-500"/> : <Layers size={20} className="text-blue-500"/>}
                {is3D ? "3D Multivariable Plot" : "Growth Motion Chart"}
            </h3>
            <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 hidden sm:inline-block">
                {is3D ? "X: Time • Y: Wellbeing • Z: Adoption" : "X: Time • Y: Wellbeing"}
            </span>
         </div>

         <div className="flex gap-2">
             {is3D && (
                 <>
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button
                            onClick={() => setFontSize(s => Math.max(8, s - 2))}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"
                            title="Decrease Text Size"
                        >
                            <Minus size={12} />
                        </button>
                        <Type size={12} className="text-slate-500" />
                        <button
                            onClick={() => setFontSize(s => Math.min(24, s + 2))}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"
                            title="Increase Text Size"
                        >
                            <Plus size={12} />
                        </button>
                    </div>

                    <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-400 mr-2 bg-slate-100 dark:bg-slate-800 px-2 rounded-lg">
                        <Move size={12} /> Drag to Rotate
                        <Search size={12} className="ml-2"/> Scroll to Zoom
                    </div>
                 </>
             )}
            <button
                onClick={() => setShowShadow(!showShadow)}
                className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm ${showShadow ? 'bg-slate-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
                title="Toggle No-Intervention Baseline"
            >
                <span className="w-3 h-0.5 bg-current border-dashed" style={{ borderStyle: 'dashed', borderWidth: '1px' }} />
                Baseline
            </button>
            <button
                onClick={() => setIs3D(!is3D)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm ${is3D ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}
            >
                <Rotate3D size={16} />
                {is3D ? "2D View" : "3D View"}
            </button>
         </div>
      </div>

      <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 overflow-hidden shadow-inner relative">
         {!is3D ? (
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e2e8f0' : '#1e293b'} />
                    <XAxis 
                        dataKey="month" 
                        type="number" 
                        domain={[0, maxMonth || 'auto']} 
                        stroke={theme === 'light' ? '#64748b' : '#94a3b8'} 
                        fontSize={10}
                        allowDataOverflow={true}
                        tickFormatter={(val) => formatDate(val)}
                    >
                        <Label value="Time" offset={0} position="insideBottom" style={{ fill: theme === 'light' ? '#64748b' : '#94a3b8', fontSize: 10 }} />
                    </XAxis>
                    <YAxis 
                        domain={[0, 100]} 
                        stroke={theme === 'light' ? '#64748b' : '#94a3b8'} 
                        fontSize={10}
                    >
                        <Label value="Wellbeing Index" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: theme === 'light' ? '#64748b' : '#94a3b8', fontSize: 10 }} />
                    </YAxis>
                    <Tooltip 
                        labelFormatter={(v) => formatDate(v as number)}
                        contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#0f172a', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px', color: theme === 'light' ? '#000' : '#fff' }} 
                    />
                    {/* Shadow Lines (No Intervention Baseline) */}
                    {showShadow && selectedCountries.map((id, idx) => {
                        return (
                            <Line
                                key={`shadow-${id}`}
                                type="monotone"
                                dataKey={`Shadow_${id}`}
                                stroke="#6b7280"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                strokeOpacity={0.6}
                                dot={false}
                                name={`${id} (No UBI)`}
                                isAnimationActive={false}
                            />
                        );
                    })}
                    {/* Main Simulation Lines */}
                    {selectedCountries.map((id, idx) => {
                        const hue = (idx * 137) % 360;
                        return (
                            <Line
                                key={id}
                                type="monotone"
                                dataKey={`Wellbeing_${id}`}
                                stroke={`hsl(${hue}, 70%, 60%)`}
                                strokeWidth={3}
                                dot={false}
                                name={id}
                                isAnimationActive={false}
                            />
                        );
                    })}
                </LineChart>
            </ResponsiveContainer>
         ) : (
            <ThreeDChart data={chartData} selectedCountries={selectedCountries} theme={theme} maxMonth={maxMonth} baseFontSize={fontSize} />
         )}
      </div>

      {/* Control Strip */}
      <div className="shrink-0">
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

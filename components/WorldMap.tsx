
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { CountryStats } from '../types';

interface WorldMapProps {
  countryData: Record<string, CountryStats>;
  onCountryClick: (id: string, delta: number) => void;
  viewMode: 'adoption' | 'wellbeing';
}

// Exhaustive mapping for world-atlas 110m (standard ISO numeric IDs)
const ID_MAP: Record<string, string> = {
  '840': 'USA', '124': 'CAN', '484': 'MEX', '156': 'CHN', '356': 'IND',
  '392': 'JPN', '410': 'KOR', '826': 'GBR', '250': 'FRA', '276': 'DEU',
  '380': 'ITA', '724': 'ESP', '578': 'NOR', '756': 'CHE', '616': 'POL',
  '804': 'UKR', '704': 'VNM', '360': 'IDN', '586': 'PAK', '050': 'BGD',
  '608': 'PHL', '792': 'TUR', '643': 'RUS', '682': 'SAU', '364': 'IRN',
  '376': 'ISR', '275': 'PSE', '566': 'NGA', '710': 'ZAF', '818': 'EGY',
  '231': 'ETH', '404': 'KEN', '180': 'COD', '076': 'BRA', '032': 'ARG',
  '170': 'COL', '036': 'AUS', '554': 'NZL', '398': 'KAZ', '764': 'THA',
  '458': 'MYS', '368': 'IRQ', '004': 'AFG', '152': 'CHL'
};

const WorldMap: React.FC<WorldMapProps> = ({ countryData, onCountryClick, viewMode }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [geography, setGeography] = useState<any>(null);
  const [hoveredStats, setHoveredStats] = useState<CountryStats | null>(null);

  useEffect(() => {
    d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then((data: any) => {
        const countries = topojson.feature(data, data.objects.countries) as any;
        setGeography(countries.features);
      })
      .catch(err => console.error("Map Load Error:", err));
  }, []);

  useEffect(() => {
    if (!svgRef.current || !geography) return;

    const width = 800;
    const height = 450;
    const svg = d3.select(svgRef.current);
    
    if (svg.selectAll('path.country').empty()) {
      const projection = d3.geoMercator()
        .scale(120)
        .translate([width / 2, height / 1.5]);

      const path = d3.geoPath().projection(projection);

      svg.selectAll('path.country')
        .data(geography)
        .join('path')
        .attr('class', 'country')
        .attr('d', path as any)
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')
        .on('contextmenu', (event, d: any) => {
          event.preventDefault();
          const isoCode = ID_MAP[d.id] || d.id;
          onCountryClick(isoCode, -5);
        })
        .on('click', (event, d: any) => {
          const isoCode = ID_MAP[d.id] || d.id;
          onCountryClick(isoCode, 5);
        })
        .on('mouseover', function(event, d: any) {
          d3.select(this).attr('stroke', '#38bdf8').attr('stroke-width', 1).raise();
          const isoCode = ID_MAP[d.id];
          if (isoCode && countryData[isoCode]) {
            setHoveredStats(countryData[isoCode]);
          }
        })
        .on('mouseout', function() {
          d3.select(this).attr('stroke', '#0f172a').attr('stroke-width', 0.5);
          setHoveredStats(null);
        });
    }

    svg.selectAll('path.country')
      .transition()
      .duration(200)
      .attr('fill', (d: any) => {
        const isoCode = ID_MAP[d.id];
        const stats = countryData[isoCode];
        if (!stats) return '#1e293b'; // Fallback for unmapped IDs
        return viewMode === 'adoption' 
            ? d3.interpolateBlues(stats.aiAdoption) 
            : d3.interpolateRdYlGn(stats.wellbeing / 100);
      });

  }, [geography, countryData, onCountryClick, viewMode]);

  return (
    <div className="relative w-full h-full min-h-[400px] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 group">
      {/* Controls Legend */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 pointer-events-none transition-opacity group-hover:opacity-100 opacity-60">
        <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700 backdrop-blur shadow-xl">
          <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Controls</div>
          <div className="flex flex-col gap-1 text-[9px] font-mono">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-sky-400" /> LEFT-CLICK: + AI GROWTH</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-400" /> RIGHT-CLICK: - AI GROWTH</div>
          </div>
        </div>
      </div>

      {/* Hover Stats Card */}
      {hoveredStats && (
        <div className="absolute bottom-4 left-4 z-20 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200">
             <div className="bg-slate-900/95 border border-slate-600 p-4 rounded-xl shadow-2xl backdrop-blur-md min-w-[180px]">
                <h3 className="text-sm font-bold text-white mb-2 border-b border-slate-700 pb-1">{hoveredStats.name}</h3>
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Adoption</span>
                        <span className="font-mono text-blue-400 font-bold">{(hoveredStats.aiAdoption * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${hoveredStats.aiAdoption * 100}%` }}></div>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs mt-2">
                        <span className="text-slate-400">Wellbeing</span>
                        <span className={`font-mono font-bold ${hoveredStats.wellbeing > 50 ? 'text-emerald-400' : 'text-rose-400'}`}>{hoveredStats.wellbeing.toFixed(0)}</span>
                    </div>
                     <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-rose-500 via-yellow-500 to-emerald-500" style={{ width: `${hoveredStats.wellbeing}%` }}></div>
                    </div>
                </div>
             </div>
        </div>
      )}

      <svg ref={svgRef} viewBox="0 0 800 450" className="w-full h-full" />
    </div>
  );
};

export default WorldMap;

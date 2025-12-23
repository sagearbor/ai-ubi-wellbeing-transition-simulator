
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { CountryStats, Corporation } from '../types';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface WorldMapProps {
  countryData: Record<string, CountryStats>;
  onCountryClick: (id: string, delta: number) => void;
  viewMode: 'adoption' | 'wellbeing' | 'ubi-received' | 'corp-hqs';
  corporations?: Corporation[];
  selectedCorpId?: string | null;
}

// Exhaustive mapping for world-atlas 110m (standard ISO numeric IDs to ISO alpha-3)
const ID_MAP: Record<string, string> = {
  // North America
  '840': 'USA', '124': 'CAN', '484': 'MEX',

  // Central America & Caribbean
  '320': 'GTM', '192': 'CUB', '332': 'HTI', '214': 'DOM', '340': 'HND',
  '558': 'NIC', '222': 'SLV', '188': 'CRI', '591': 'PAN', '388': 'JAM',
  '084': 'BLZ', '044': 'BHS', '780': 'TTO', '630': 'PRI', // PRI is Puerto Rico (often mapped)

  // South America
  '076': 'BRA', '032': 'ARG', '170': 'COL', '152': 'CHL', '604': 'PER',
  '862': 'VEN', '218': 'ECU', '068': 'BOL', '600': 'PRY', '858': 'URY',
  '328': 'GUY', '740': 'SUR',
  
  // Europe
  '643': 'RUS', '826': 'GBR', '250': 'FRA', '276': 'DEU', '380': 'ITA',
  '724': 'ESP', '528': 'NLD', '752': 'SWE', '056': 'BEL', '040': 'AUT',
  '616': 'POL', '578': 'NOR', '756': 'CHE', '372': 'IRL', '208': 'DNK',
  '246': 'FIN', '620': 'PRT', '300': 'GRC', '203': 'CZE', '348': 'HUN',
  '642': 'ROU', '804': 'UKR', '112': 'BLR', '688': 'SRB', '703': 'SVK',
  '191': 'HRV', '070': 'BIH', '498': 'MDA', '100': 'BGR', '008': 'ALB',
  '807': 'MKD', '705': 'SVN', '440': 'LTU', '428': 'LVA', '233': 'EST',
  '352': 'ISL', '499': 'MNE', '442': 'LUX', '196': 'CYP', '470': 'MLT',
  
  // East & SE Asia
  '156': 'CHN', '392': 'JPN', '410': 'KOR', '158': 'TWN', '496': 'MNG', 
  '408': 'PRK', '704': 'VNM', '360': 'IDN', '608': 'PHL', '764': 'THA', 
  '458': 'MYS', '702': 'SGP', '104': 'MMR', '116': 'KHM', '418': 'LAO', 
  '096': 'BRN', '626': 'TLS',
  
  // South & Central Asia
  '356': 'IND', '586': 'PAK', '050': 'BGD', '144': 'LKA', '524': 'NPL', 
  '064': 'BTN', '398': 'KAZ', '860': 'UZB', '795': 'TKM', '417': 'KGZ', 
  '762': 'TJK', '462': 'MDV',
  
  // Middle East / West Asia
  '792': 'TUR', '682': 'SAU', '364': 'IRN', '368': 'IRQ', '004': 'AFG',
  '784': 'ARE', '376': 'ISR', '400': 'JOR', '422': 'LBN', '760': 'SYR', 
  '887': 'YEM', '512': 'OMN', '634': 'QAT', '414': 'KWT', '048': 'BHR',
  '031': 'AZE', '268': 'GEO', '051': 'ARM', '275': 'PSE',
  
  // Africa
  '566': 'NGA', '710': 'ZAF', '818': 'EGY', '231': 'ETH', '404': 'KEN',
  '180': 'COD', '504': 'MAR', '012': 'DZA', '024': 'AGO',

  // Oceania
  '036': 'AUS', '554': 'NZL', '598': 'PNG'
};

const WorldMap: React.FC<WorldMapProps> = ({ countryData, onCountryClick, viewMode, corporations = [], selectedCorpId = null }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
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

  // Zoom Handling
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .translateExtent([[0, 0], [800, 450]])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as any);
  }, [geography]); // Re-attach if geography loads, though strictly only needs mounting

  // Programmatic Zoom controls
  const handleZoom = (factor: number) => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom().scaleExtent([1, 8]).translateExtent([[0, 0], [800, 450]]);
    
    if (factor === 0) {
       // Reset
       svg.transition().duration(750).call((zoom.transform as any), d3.zoomIdentity);
    } else {
       svg.transition().duration(300).call((zoom.scaleBy as any), factor);
    }
  };

  useEffect(() => {
    if (!gRef.current || !geography) return;

    const width = 800;
    const height = 450;
    const g = d3.select(gRef.current);
    
    // Draw countries if not already drawn
    if (g.selectAll('path.country').empty()) {
      const projection = d3.geoMercator()
        .scale(120)
        .translate([width / 2, height / 1.5]);

      const path = d3.geoPath().projection(projection);

      g.selectAll('path.country')
        .data(geography)
        .join('path')
        .attr('class', 'country')
        .attr('d', path as any)
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 0.1) // Fine stroke for zoom
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
          d3.select(this).attr('stroke', '#38bdf8').attr('stroke-width', 0.5).raise();
          const isoCode = ID_MAP[d.id];
          if (isoCode && countryData[isoCode]) {
            setHoveredStats(countryData[isoCode]);
          }
        })
        .on('mouseout', function() {
          d3.select(this).attr('stroke', '#0f172a').attr('stroke-width', 0.1);
          setHoveredStats(null);
        });
    }

    // Update Colors based on simulation state
    g.selectAll('path.country')
      .transition()
      .duration(200)
      .attr('fill', (d: any) => {
        const isoCode = ID_MAP[d.id];
        const stats = countryData[isoCode];
        if (!stats) return '#1e293b'; // Fallback for unmapped IDs

        // Calculate color based on view mode
        if (viewMode === 'adoption') {
          return d3.interpolateBlues(stats.aiAdoption);
        } else if (viewMode === 'wellbeing') {
          return d3.interpolateRdYlGn(stats.wellbeing / 100);
        } else if (viewMode === 'ubi-received') {
          // Color by UBI per capita (normalize to reasonable range 0-500/month)
          const ubiPerCapita = stats.totalUbiReceived / stats.population;
          const normalized = Math.min(1, ubiPerCapita / 500);
          return d3.interpolateGreens(normalized);
        } else if (viewMode === 'corp-hqs') {
          // Color by number of HQ corps (0-10 range)
          const hqCount = stats.headquarteredCorps?.length || 0;
          const normalized = Math.min(1, hqCount / 10);
          return d3.interpolatePurples(normalized);
        }
        return '#1e293b';
      })
      .attr('stroke', (d: any) => {
        const isoCode = ID_MAP[d.id];

        // Special border for selected corporation HQ
        if (selectedCorpId) {
          const selectedCorp = corporations.find(c => c.id === selectedCorpId);
          if (selectedCorp) {
            // HQ country gets special border
            if (selectedCorp.headquartersCountry === isoCode) {
              return '#f59e0b'; // Amber border for HQ
            }
            // Operating countries get different border
            if (selectedCorp.operatingCountries.includes(isoCode)) {
              return '#3b82f6'; // Blue border for operating countries
            }
          }
        }
        return '#0f172a';
      })
      .attr('stroke-width', (d: any) => {
        const isoCode = ID_MAP[d.id];

        // Thicker border for selected corporation countries
        if (selectedCorpId) {
          const selectedCorp = corporations.find(c => c.id === selectedCorpId);
          if (selectedCorp) {
            if (selectedCorp.headquartersCountry === isoCode) {
              return 1.5; // Thick border for HQ
            }
            if (selectedCorp.operatingCountries.includes(isoCode)) {
              return 0.8; // Medium border for operating countries
            }
          }
        }
        return 0.1;
      });

  }, [geography, countryData, onCountryClick, viewMode, corporations, selectedCorpId]);

  return (
    <div className="relative w-full h-full min-h-[400px] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 group">
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10 pointer-events-auto">
         <div className="bg-slate-800/90 p-1.5 rounded-xl border border-slate-700 backdrop-blur shadow-xl flex flex-col gap-1">
            <button onClick={() => handleZoom(1.3)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><ZoomIn size={16} /></button>
            <button onClick={() => handleZoom(0.7)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><ZoomOut size={16} /></button>
            <button onClick={() => handleZoom(0)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><Maximize size={16} /></button>
         </div>
      </div>

      {/* Controls Legend */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 pointer-events-none transition-opacity group-hover:opacity-100 opacity-60">
        <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700 backdrop-blur shadow-xl">
          <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Controls</div>
          <div className="flex flex-col gap-1 text-[9px] font-mono">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-sky-400" /> LEFT-CLICK: + AI GROWTH</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-400" /> RIGHT-CLICK: - AI GROWTH</div>
            <div className="flex items-center gap-2 text-slate-400 mt-1"><Maximize size={8} /> SCROLL/PINCH TO ZOOM</div>
          </div>
        </div>
      </div>

      {/* Hover Stats Card */}
      {hoveredStats && (
        <div className="absolute bottom-4 left-4 z-20 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200">
             <div className="bg-slate-900/95 border border-slate-600 p-4 rounded-xl shadow-2xl backdrop-blur-md min-w-[220px]">
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

                    {/* Corporation-related stats */}
                    <div className="border-t border-slate-700 mt-2 pt-2">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">UBI/month</span>
                            <span className="font-mono text-green-400 font-bold">
                                ${(hoveredStats.totalUbiReceived / hoveredStats.population).toFixed(0)}/person
                            </span>
                        </div>
                        {hoveredStats.totalUbiReceived > 0 && (
                            <div className="text-[9px] text-slate-500 mt-0.5 space-y-0.5">
                                <div>Global: ${(hoveredStats.ubiReceivedGlobal / hoveredStats.population).toFixed(0)}</div>
                                <div>Customer-weighted: ${(hoveredStats.ubiReceivedCustomerWeighted / hoveredStats.population).toFixed(0)}</div>
                                <div>Local: ${(hoveredStats.ubiReceivedLocal / hoveredStats.population).toFixed(0)}</div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center text-xs mt-1">
                        <span className="text-slate-400">Corp HQs</span>
                        <span className="font-mono text-purple-400 font-bold">{hoveredStats.headquarteredCorps?.length || 0}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Corps operating</span>
                        <span className="font-mono text-cyan-400 font-bold">{hoveredStats.customerOfCorps?.length || 0}</span>
                    </div>
                </div>
             </div>
        </div>
      )}

      <svg ref={svgRef} viewBox="0 0 800 450" className="w-full h-full cursor-grab active:cursor-grabbing">
         <g ref={gRef}></g>
      </svg>
    </div>
  );
};

export default WorldMap;

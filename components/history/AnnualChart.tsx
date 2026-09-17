import React, { useEffect, useId, useRef, useState } from 'react';
import { annualFormat, annualLinePath, type AnnualDisplayRow } from '../../src/history/annual';

export default function AnnualChart({ rows, changes, year, onYear, label, candidate }: {
  rows: AnnualDisplayRow[]; changes?: boolean; year: number; onYear: (year: number) => void;
  label: string; candidate: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(900);
  const id = useId();
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(280, entries[0].contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const keys = changes ? ['persistenceChange', 'modeledChange', 'observedChange'] as const : ['persistence', 'modeled', 'observed'] as const;
  const values = rows.flatMap(row => keys.map(key => row[key])).filter((v): v is number => v !== null);
  const min = Math.min(...values, ...(changes ? [0] : []));
  const max = Math.max(...values, ...(changes ? [0] : []));
  const pad = (max - min || 1) * 0.12;
  const low = changes ? min - pad : Math.max(0, min - pad);
  const high = max + pad;
  const first = rows[0].year, last = rows.at(-1)!.year;
  const left = 65, right = width - 15, top = 18, bottom = 226;
  const x = (v: number) => left + (v - first) / (last - first || 1) * (right - left);
  const y = (v: number) => bottom - (v - low) / (high - low || 1) * (bottom - top);
  const selected = rows.find(row => row.year === year);
  const tickCount = width < 500 ? 4 : 7;
  const ticks = Array.from(new Set(Array.from({ length: tickCount }, (_, i) => Math.round(first + i * (last - first) / (tickCount - 1)))));
  const compact = (v: number) => Math.abs(v) >= 1000 ? `${annualFormat(v / 1000, 0)}k` : annualFormat(v, max - min < 3 ? 1 : 0);
  return <svg ref={ref} viewBox={`0 0 ${width} 263`} role="img" aria-labelledby={`${id}-title ${id}-desc`}
    onPointerMove={event => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const px = (event.clientX - bounds.left) / bounds.width * width;
      onYear(Math.max(first, Math.min(last, Math.round(first + (px - left) / (right - left) * (last - first)))));
    }}>
    <title id={`${id}-title`}>{label}</title>
    <desc id={`${id}-desc`}>Observed values, {candidate}, and persistence. Missing years break lines. Axes fit the selected series; k means thousand. Use the inspect-year slider or annual values table for exact accessible values.</desc>
    {[0, 1, 2, 3, 4].map(t => {
      const v = low + (high - low) * t / 4;
      return <g key={t}><line x1={left} x2={right} y1={y(v)} y2={y(v)} className="history-grid"/><text x={left - 10} y={y(v) + 5} textAnchor="end">{compact(v)}</text></g>;
    })}
    {changes && <line x1={left} x2={right} y1={y(0)} y2={y(0)} className="annual-zero"/>}
    {ticks.map(t => <text key={t} x={x(t)} y="252" textAnchor="middle">{t}</text>)}
    {keys.map((key, i) => <path key={key} d={annualLinePath(rows, key, x, y)} className={`history-line ${['history-persistence', 'history-modeled', 'history-observed'][i]}`} strokeDasharray={i === 0 ? '6 5' : undefined}/>)}
    {/* A one-point segment has only an SVG move command, so every available
        series needs a marker to keep isolated forecasts visible across gaps. */}
    {keys.map((key, i) => rows.map(row => row[key] !== null && <circle key={`${key}-${row.year}`} data-series={key} data-year={row.year}
      cx={x(row.year)} cy={y(row[key]!)} r={i === 2 ? 2.5 : 2}
      className={`annual-series-point ${['history-persistence', 'history-modeled', 'history-observed'][i]}`}
      style={{ fill: 'currentColor', stroke: 'none' }}><title>{`${row.year}: ${annualFormat(row[key], 3)}`}</title></circle>))}
    {selected && <g><line x1={x(year)} x2={x(year)} y1={top} y2={bottom} className="annual-cursor"/>
      {keys.map((key, i) => selected[key] !== null && <circle key={key} cx={x(year)} cy={y(selected[key]!)} r="5" className={`annual-focus-point ${['history-persistence', 'history-modeled', 'history-observed'][i]}`}/>)}</g>}
  </svg>;
}

/**
 * GoodnessRiver — "the one graph" (design doc sections 0, 4.4 and 9).
 *
 * x = year (graph.startYear .. graph.endYear), y = goodness of the world 0-100.
 * Each world-state is a ribbon centred at its fixed goodness whose thickness is its
 * probability. The solid line is the current expected goodness, the dashed line the
 * baseline mean, and the violet wedge between them is the effect of everything the
 * user has toggled or dragged.
 *
 * This file also owns the shared valence palette (as CSS custom properties, so light
 * and dark are handled by CSS rather than by JS) and a couple of formatting helpers
 * that the sibling components import. Kept here rather than in a new module because
 * this package owns a fixed file list.
 */

import React, { useMemo, useState } from 'react';
import { FuturesGraph, FuturesNode, GoodnessSeries } from '../../src/futures/types';

// ---------------------------------------------------------------------------
// Shared palette + helpers
// ---------------------------------------------------------------------------

/**
 * Valence colours from the design doc, scoped to `.fx-scope` so they never leak.
 * Three dark signals are honoured: the OS preference (what Tailwind 4's `dark:`
 * variant uses by default in this repo) and the `.dark` / `.light` class App.tsx
 * puts on <html>, so the palette always agrees with the surrounding chrome.
 */
export const FX_SCOPE_CSS = `
.fx-scope{
  --fx-good:#1baf7a; --fx-bad:#eb6834; --fx-xrisk:#e34948; --fx-neutral:#2a78d6; --fx-mixed:#eda100;
  --fx-ink:#0b0b0b; --fx-ink2:#52514e; --fx-muted:#898781; --fx-grid:#e1e0d9;
  --fx-surface:#fcfcfb; --fx-violet:#4a3aa7;
}
@media (prefers-color-scheme:dark){
  .fx-scope{
    --fx-good:#199e70; --fx-bad:#d95926; --fx-xrisk:#e66767; --fx-neutral:#3987e5; --fx-mixed:#c98500;
    --fx-ink:#ffffff; --fx-ink2:#c3c2b7; --fx-muted:#898781; --fx-grid:#2c2c2a;
    --fx-surface:#17171a; --fx-violet:#9085e9;
  }
}
.dark .fx-scope{
  --fx-good:#199e70; --fx-bad:#d95926; --fx-xrisk:#e66767; --fx-neutral:#3987e5; --fx-mixed:#c98500;
  --fx-ink:#ffffff; --fx-ink2:#c3c2b7; --fx-muted:#898781; --fx-grid:#2c2c2a;
  --fx-surface:#17171a; --fx-violet:#9085e9;
}
.light .fx-scope{
  --fx-good:#1baf7a; --fx-bad:#eb6834; --fx-xrisk:#e34948; --fx-neutral:#2a78d6; --fx-mixed:#eda100;
  --fx-ink:#0b0b0b; --fx-ink2:#52514e; --fx-muted:#898781; --fx-grid:#e1e0d9;
  --fx-surface:#fcfcfb; --fx-violet:#4a3aa7;
}
.fx-scope input[type=range]{accent-color:var(--fx-violet);}
`;

/** Colour for a node: severity `existential` overrides valence, per the design doc. */
export function colorVarOf(node: FuturesNode): string {
  if (node.severity === 'existential') return 'var(--fx-xrisk)';
  switch (node.valence) {
    case 'good':
      return 'var(--fx-good)';
    case 'bad':
      return 'var(--fx-bad)';
    case 'mixed':
      return 'var(--fx-mixed)';
    default:
      return 'var(--fx-neutral)';
  }
}

export const isExistentialState = (node: FuturesNode): boolean =>
  node.kind === 'state' && (node.severity === 'existential' || node.goodness === 0);

export const pct = (p: number, digits = 0): string => `${(p * 100).toFixed(digits)}%`;
export const clampN = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

/** State nodes on the axis, best goodness first. */
export function orderedStates(graph: FuturesGraph): FuturesNode[] {
  const byId = new Map(graph.nodes.filter((n) => !n.retired).map((n) => [n.id, n]));
  return graph.axis.states
    .map((id) => byId.get(id))
    .filter((n): n is FuturesNode => !!n && n.kind === 'state')
    .sort((a, b) => (b.goodness ?? 0) - (a.goodness ?? 0));
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const RW = 640;
const RH = 260;
const RL = 44;
const RR = 16;
const RT = 14;
const RB = 28;
/** Ribbon thickness in px at P = 1. */
const THICK = 120;
/** The existential ribbon is never thinner than this, or the tail vanishes. */
const MIN_THICK = 2;

export interface GoodnessRiverProps {
  graph: FuturesGraph;
  years: number[];
  /** Current solve. */
  P: Record<string, number[]>;
  /** Baseline (unnudged) curves. */
  baseP: Record<string, number[]>;
  current: GoodnessSeries;
  baseline: GoodnessSeries;
  scrubYear: number;
  onScrubYear: (year: number) => void;
}

const GoodnessRiver: React.FC<GoodnessRiverProps> = ({
  graph,
  years,
  P,
  baseP,
  current,
  baseline,
  scrubYear,
  onScrubYear,
}) => {
  const [hoverT, setHoverT] = useState<number | null>(null);
  const nY = years.length;
  const states = useMemo(() => orderedStates(graph), [graph]);

  const rx = (t: number) => RL + (nY > 1 ? t / (nY - 1) : 0) * (RW - RL - RR);
  const ry = (g: number) => RT + ((100 - g) / 100) * (RH - RT - RB);

  const halfThickness = (node: FuturesNode, t: number): number => {
    const raw = (P[node.id]?.[t] ?? 0) * THICK;
    const min = isExistentialState(node) ? MIN_THICK : 0;
    return Math.max(raw, min) / 2;
  };

  const ribbonPath = (node: FuturesNode): string => {
    const v = node.goodness ?? 0;
    let d = '';
    for (let t = 0; t < nY; t++) d += `${t ? 'L' : 'M'}${rx(t).toFixed(1)},${(ry(v) - halfThickness(node, t)).toFixed(1)} `;
    for (let t = nY - 1; t >= 0; t--) d += `L${rx(t).toFixed(1)},${(ry(v) + halfThickness(node, t)).toFixed(1)} `;
    return `${d}Z`;
  };

  const linePath = (arr: number[]): string =>
    arr.map((g, t) => `${t ? 'L' : 'M'}${rx(t).toFixed(1)},${ry(g).toFixed(1)}`).join(' ');

  const changed = current.mean.some((g, t) => Math.abs(g - baseline.mean[t]) > 0.05);

  const wedgePath = useMemo(() => {
    if (!changed) return '';
    let d = linePath(current.mean);
    for (let t = nY - 1; t >= 0; t--) d += ` L${rx(t).toFixed(1)},${ry(baseline.mean[t]).toFixed(1)}`;
    return `${d} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changed, current, baseline, nY]);

  const yearTicks = useMemo(() => {
    const wanted = [graph.startYear, ...graph.axis.horizons, graph.endYear];
    return Array.from(new Set(wanted.filter((y) => y >= graph.startYear && y <= graph.endYear))).sort((a, b) => a - b);
  }, [graph]);

  const tFromPointer = (e: React.PointerEvent<SVGSVGElement>): number => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width) return 0;
    const x = ((e.clientX - r.left) / r.width) * RW;
    return Math.round(clampN(((x - RL) / (RW - RL - RR)) * (nY - 1), 0, nY - 1));
  };

  const readoutT = hoverT ?? clampN(scrubYear - graph.startYear, 0, nY - 1);
  const scrubT = clampN(scrubYear - graph.startYear, 0, nY - 1);

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${RW} ${RH}`}
        role="img"
        aria-label={`Goodness of the world from ${graph.startYear} to ${graph.endYear}; ribbon thickness is the probability of each world-state`}
        className="block w-full h-auto rounded-xl border border-slate-200 dark:border-slate-800"
        style={{ background: 'var(--fx-surface)', touchAction: 'pan-y' }}
        onPointerMove={(e) => setHoverT(tFromPointer(e))}
        onPointerDown={(e) => onScrubYear(graph.startYear + tFromPointer(e))}
        onPointerLeave={() => setHoverT(null)}
      >
        {/* goodness gridlines, one per state */}
        {states.map((s) => (
          <g key={`grid-${s.id}`}>
            <line x1={RL} x2={RW - RR} y1={ry(s.goodness ?? 0)} y2={ry(s.goodness ?? 0)} stroke="var(--fx-grid)" />
            <text x={RL - 6} y={ry(s.goodness ?? 0) + 4} textAnchor="end" fontSize={11} fill="var(--fx-muted)">
              {s.goodness}
            </text>
          </g>
        ))}

        {/* year ticks */}
        {yearTicks.map((y) => (
          <text key={`tick-${y}`} x={rx(y - graph.startYear)} y={RH - 8} textAnchor="middle" fontSize={11} fill="var(--fx-muted)">
            {y}
          </text>
        ))}

        {/* wedge between baseline mean and current mean */}
        {changed && <path d={wedgePath} fill="var(--fx-violet)" opacity={0.18} />}

        {/* ribbons */}
        {states.map((s) => (
          <path key={`rib-${s.id}`} d={ribbonPath(s)} fill={colorVarOf(s)} opacity={0.55}>
            <title>{`${s.label}: ${pct(P[s.id]?.[readoutT] ?? 0, 1)} in ${years[readoutT]}`}</title>
          </path>
        ))}

        {/* state labels, right-aligned at the end year on each ribbon's centre line */}
        {states.map((s) => (
          <text
            key={`lab-${s.id}`}
            x={rx(nY - 1) - 8}
            y={ry(s.goodness ?? 0) + 4}
            textAnchor="end"
            fontSize={11}
            fontWeight={600}
            fill="var(--fx-ink)"
            style={{ paintOrder: 'stroke', stroke: 'var(--fx-surface)', strokeWidth: 3, strokeLinejoin: 'round' }}
          >
            {`${s.label} ${pct(P[s.id]?.[nY - 1] ?? 0)}`}
          </text>
        ))}

        {/* baseline mean (dashed) + current mean (solid) */}
        {changed && <path d={linePath(baseline.mean)} fill="none" stroke="var(--fx-ink2)" strokeWidth={1.5} strokeDasharray="4 3" />}
        <path d={linePath(current.mean)} fill="none" stroke="var(--fx-ink)" strokeWidth={2.5} />
        <text
          x={rx(Math.floor(nY / 2))}
          y={ry(current.mean[Math.floor(nY / 2)]) - 8}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill="var(--fx-ink)"
          style={{ paintOrder: 'stroke', stroke: 'var(--fx-surface)', strokeWidth: 3, strokeLinejoin: 'round' }}
        >
          {`mean ${current.mean[nY - 1].toFixed(0)} by ${graph.endYear}`}
        </text>

        {/* scrubber + hover line */}
        <line x1={rx(scrubT)} x2={rx(scrubT)} y1={RT} y2={RH - RB} stroke="var(--fx-violet)" strokeWidth={1.5} strokeDasharray="3 3" />
        {hoverT !== null && hoverT !== scrubT && (
          <line x1={rx(hoverT)} x2={rx(hoverT)} y1={RT} y2={RH - RB} stroke="var(--fx-ink2)" strokeWidth={1} opacity={0.7} />
        )}

      </svg>
      <p className="mt-1 text-[11px] uppercase tracking-wider" style={{ color: 'var(--fx-muted)' }}>
        Goodness of the world · ribbon thickness = probability · solid = mean · dashed = baseline mean
      </p>

      {/* readout */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums" style={{ color: 'var(--fx-ink2)' }}>
        <span className="font-semibold" style={{ color: 'var(--fx-ink)' }}>
          {years[readoutT]}
        </span>
        {states.map((s) => (
          <span key={`ro-${s.id}`} className="inline-flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: colorVarOf(s) }} aria-hidden="true" />
            {s.shortLabel ?? s.label} {pct(P[s.id]?.[readoutT] ?? 0, 1)}
            {Math.abs((P[s.id]?.[readoutT] ?? 0) - (baseP[s.id]?.[readoutT] ?? 0)) >= 0.005 && (
              <span style={{ color: 'var(--fx-muted)' }}>(was {pct(baseP[s.id]?.[readoutT] ?? 0, 1)})</span>
            )}
          </span>
        ))}
      </div>

      {/* year scrubber */}
      <label className="mt-2 flex items-center gap-3 text-[11px]" style={{ color: 'var(--fx-ink2)' }}>
        <span className="shrink-0">Year {scrubYear}</span>
        <input
          type="range"
          className="w-full h-11"
          min={graph.startYear}
          max={graph.endYear}
          step={1}
          value={scrubYear}
          aria-label="Scrub year on the goodness river"
          onChange={(e) => onScrubYear(Number(e.target.value))}
        />
      </label>
    </div>
  );
};

export default GoodnessRiver;

/**
 * GoodnessRiver — the one graph.
 *
 * Two panels sharing one x-axis (years):
 *   A. "Share of futures": a 100% stacked area. The five exclusive world-states are stacked in
 *      goodness order, best at the top, so up is good and down is bad, and every column sums to
 *      100%. Band height = that state's probability in that year.
 *   B. "Expected goodness": the probability-weighted mean goodness (0-100) with the baseline
 *      mean dashed and the difference shaded as a wedge, the way climate stabilisation wedges
 *      show what an intervention buys.
 *
 * Colour is reserved for valence (aqua good, orange bad, red existential, amber mixed, blue
 * neutral). D3 is not needed: the maths is straight from src/futures/engine.ts.
 */
import React, { useMemo, useState } from 'react';
import type { FuturesGraph, FuturesNode, GoodnessSeries } from '../../src/futures/types';

// ---------------------------------------------------------------------------
// Shared palette + helpers
// ---------------------------------------------------------------------------

/**
 * Valence colours from the design doc, scoped to `.fx-scope` so they never leak.
 * Honours the OS preference and the `.dark` / `.light` class App.tsx puts on <html>.
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

export function isExistentialState(node: FuturesNode): boolean {
  return node.kind === 'state' && (node.severity === 'existential' || (node.goodness ?? 100) <= 0);
}

/** World-states in goodness order, best first. */
export function orderedStates(graph: FuturesGraph): FuturesNode[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  return graph.axis.states
    .map((id) => byId.get(id))
    .filter((n): n is FuturesNode => !!n && !n.retired)
    .sort((a, b) => (b.goodness ?? 0) - (a.goodness ?? 0));
}

export const pct = (p: number, digits = 0): string => `${(p * 100).toFixed(digits)}%`;

export const clampN = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const RW = 640;
const RL = 44;
const RR = 16;
// Panel A: share of futures (100% stacked)
const AT = 14;
const AB = 222;
// Panel B: expected goodness
const BT = 252;
const BB = 346;
const RH = 372;
/** The existential band is never thinner than this, or the tail vanishes. */
const MIN_BAND = 2;

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
  /** Panel A: cumulative share (0 at top, 1 at bottom). */
  const ay = (share: number) => AT + share * (AB - AT);
  /** Panel B: goodness 0-100, 100 at top. */
  const by = (g: number) => BT + ((100 - g) / 100) * (BB - BT);

  // Stacked bands: top boundary = sum of P for states above (better), bottom = top + P.
  // The existential band keeps a minimum pixel height so the tail never visually vanishes.
  const bands = useMemo(() => {
    const tops: number[][] = [];
    const bottoms: number[][] = [];
    const cum = new Array(nY).fill(0);
    states.forEach((s) => {
      const top = [...cum];
      const bottom = cum.map((c, t) => c + (P[s.id]?.[t] ?? 0));
      tops.push(top);
      bottoms.push(bottom);
      for (let t = 0; t < nY; t++) cum[t] = bottom[t];
    });
    return states.map((s, i) => {
      let d = '';
      for (let t = 0; t < nY; t++) d += `${t ? 'L' : 'M'}${rx(t).toFixed(1)},${ay(tops[i][t]).toFixed(1)} `;
      for (let t = nY - 1; t >= 0; t--) {
        let yB = ay(bottoms[i][t]);
        if (isExistentialState(s)) yB = Math.max(yB, ay(tops[i][t]) + MIN_BAND);
        d += `L${rx(t).toFixed(1)},${yB.toFixed(1)} `;
      }
      const endMid = (tops[i][nY - 1] + bottoms[i][nY - 1]) / 2;
      const endShare = bottoms[i][nY - 1] - tops[i][nY - 1];
      return { node: s, path: `${d}Z`, endMid, endShare };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states, P, nY]);

  const linePath = (arr: number[]): string =>
    arr.map((g, t) => `${t ? 'L' : 'M'}${rx(t).toFixed(1)},${by(g).toFixed(1)}`).join(' ');

  const changed = current.mean.some((g, t) => Math.abs(g - baseline.mean[t]) > 0.05);

  const wedgePath = useMemo(() => {
    if (!changed) return '';
    let d = linePath(current.mean);
    for (let t = nY - 1; t >= 0; t--) d += ` L${rx(t).toFixed(1)},${by(baseline.mean[t]).toFixed(1)}`;
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
  const labelStroke = { paintOrder: 'stroke' as const, stroke: 'var(--fx-surface)', strokeWidth: 3, strokeLinejoin: 'round' as const };

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${RW} ${RH}`}
        role="img"
        aria-label={`Share of futures by world-state from ${graph.startYear} to ${graph.endYear}, stacked best to worst, and expected goodness of the world`}
        className="block w-full h-auto rounded-xl border border-slate-200 dark:border-slate-800"
        style={{ background: 'var(--fx-surface)', touchAction: 'pan-y' }}
        onPointerMove={(e) => setHoverT(tFromPointer(e))}
        onPointerDown={(e) => onScrubYear(graph.startYear + tFromPointer(e))}
        onPointerLeave={() => setHoverT(null)}
      >
        {/* ---------- Panel A: share of futures ---------- */}
        <text x={RL} y={AT - 3} fontSize={10} fill="var(--fx-muted)" style={{ letterSpacing: '0.06em' }}>
          SHARE OF FUTURES · BEST AT TOP · EVERY YEAR SUMS TO 100%
        </text>
        {[0, 0.25, 0.5, 0.75, 1].map((s) => (
          <g key={`agrid-${s}`}>
            <line x1={RL} x2={RW - RR} y1={ay(s)} y2={ay(s)} stroke="var(--fx-grid)" />
            <text x={RL - 6} y={ay(s) + 4} textAnchor="end" fontSize={10} fill="var(--fx-muted)">
              {Math.round((1 - s) * 100)}%
            </text>
          </g>
        ))}
        {bands.map(({ node, path }) => (
          <path key={`band-${node.id}`} d={path} fill={colorVarOf(node)} opacity={0.72} stroke="var(--fx-surface)" strokeWidth={1.5}>
            <title>{`${node.label}: ${pct(P[node.id]?.[readoutT] ?? 0, 1)} in ${years[readoutT]}`}</title>
          </path>
        ))}
        {bands
          .filter((b) => b.endShare >= 0.045)
          .map(({ node, endMid }) => (
            <text
              key={`blab-${node.id}`}
              x={rx(nY - 1) - 8}
              y={ay(endMid) + 4}
              textAnchor="end"
              fontSize={11}
              fontWeight={600}
              fill="var(--fx-ink)"
              style={labelStroke}
            >
              {`${node.label} ${pct(P[node.id]?.[nY - 1] ?? 0)}`}
            </text>
          ))}

        {/* ---------- Panel B: expected goodness ---------- */}
        <text x={RL} y={BT - 6} fontSize={10} fill="var(--fx-muted)" style={{ letterSpacing: '0.06em' }}>
          EXPECTED GOODNESS OF THE WORLD (0–100) · SOLID = NOW · DASHED = BASELINE
        </text>
        {[0, 50, 100].map((g) => (
          <g key={`bgrid-${g}`}>
            <line x1={RL} x2={RW - RR} y1={by(g)} y2={by(g)} stroke="var(--fx-grid)" />
            <text x={RL - 6} y={by(g) + 4} textAnchor="end" fontSize={10} fill="var(--fx-muted)">
              {g}
            </text>
          </g>
        ))}
        {changed && <path d={wedgePath} fill="var(--fx-violet)" opacity={0.22} />}
        {changed && <path d={linePath(baseline.mean)} fill="none" stroke="var(--fx-ink2)" strokeWidth={1.5} strokeDasharray="4 3" />}
        <path d={linePath(current.mean)} fill="none" stroke="var(--fx-ink)" strokeWidth={2.5} />
        <text
          x={rx(nY - 1) - 8}
          y={by(current.mean[nY - 1]) - 8}
          textAnchor="end"
          fontSize={11}
          fontWeight={600}
          fill="var(--fx-ink)"
          style={labelStroke}
        >
          {`mean ${current.mean[nY - 1].toFixed(0)} by ${graph.endYear}${changed ? ` (was ${baseline.mean[nY - 1].toFixed(0)})` : ''}`}
        </text>

        {/* year ticks */}
        {yearTicks.map((y) => (
          <text key={`tick-${y}`} x={rx(y - graph.startYear)} y={RH - 8} textAnchor="middle" fontSize={11} fill="var(--fx-muted)">
            {y}
          </text>
        ))}

        {/* scrubber + hover line, across both panels */}
        <line x1={rx(scrubT)} x2={rx(scrubT)} y1={AT} y2={BB} stroke="var(--fx-violet)" strokeWidth={1.5} strokeDasharray="3 3" />
        {hoverT !== null && hoverT !== scrubT && (
          <line x1={rx(hoverT)} x2={rx(hoverT)} y1={AT} y2={BB} stroke="var(--fx-ink2)" strokeWidth={1} opacity={0.7} />
        )}
      </svg>
      <p className="mt-1 text-[11px] uppercase tracking-wider" style={{ color: 'var(--fx-muted)' }}>
        Goodness of the world · top: share of futures by world-state, stacked best to worst · bottom: expected goodness, wedge = what your changes buy
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
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ background: 'var(--fx-ink)' }} aria-hidden="true" />
          mean {current.mean[readoutT].toFixed(1)}
          {Math.abs(current.mean[readoutT] - baseline.mean[readoutT]) >= 0.05 && (
            <span style={{ color: 'var(--fx-muted)' }}>(was {baseline.mean[readoutT].toFixed(1)})</span>
          )}
        </span>
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
          aria-label="Scrub year on the goodness chart"
          onChange={(e) => onScrubYear(Number(e.target.value))}
        />
      </label>
    </div>
  );
};

export default GoodnessRiver;

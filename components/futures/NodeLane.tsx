/**
 * NodeLane — one event node: label, "by <mid> / by <end>" numbers, a small area chart
 * (faint fill = seed baseline, solid line = after your changes), a log-odds nudge slider,
 * and a details expander carrying everything the number is claiming: the operationalisation,
 * the narrative, the seed basis with its sources, and every parent edge with its note.
 *
 * Design doc sections 3 and 9 ("Lanes"), and the reference implementation's lane markup.
 */

import React, { useState } from 'react';
import { FuturesNode } from '../../src/futures/types';
import { clampN, colorVarOf, pct } from './GoodnessRiver';

export interface NodeLaneProps {
  node: FuturesNode;
  years: number[];
  /** Baseline curve for this node, dense over `years`. */
  base: number[];
  /** Current (solved) curve for this node, dense over `years`. */
  cur: number[];
  /** Slider value in log-odds, -3..3. */
  value: number;
  onChange: (nodeId: string, logOdds: number) => void;
  /** Mid horizon shown alongside the end year, e.g. 2035. */
  midYear: number;
  endYear: number;
  nodesById: Map<string, FuturesNode>;
}

const LW = 300;
const LH = 54;

const xs = (t: number, nY: number) => (nY > 1 ? (t / (nY - 1)) * LW : 0);
const ys = (p: number) => LH - 2 - p * (LH - 6);

const pathOf = (arr: number[]) => arr.map((p, t) => `${t ? 'L' : 'M'}${xs(t, arr.length).toFixed(1)},${ys(p).toFixed(1)}`).join('');
const areaOf = (arr: number[]) => `${pathOf(arr)}L${LW},${LH}L0,${LH}Z`;

const NodeLane: React.FC<NodeLaneProps> = ({ node, years, base, cur, value, onChange, midYear, endYear, nodesById }) => {
  const [hoverT, setHoverT] = useState<number | null>(null);
  const nY = years.length;
  const color = colorVarOf(node);

  const at = (year: number) => clampN(years.indexOf(year) >= 0 ? years.indexOf(year) : nY - 1, 0, nY - 1);
  const tMid = at(midYear);
  const tEnd = at(endYear);

  const num = (b: number, c: number) =>
    Math.abs(b - c) >= 0.005 ? (
      <>
        <b className="text-slate-800 dark:text-white">{pct(c)}</b>{' '}
        <s className="text-slate-400 dark:text-slate-500">{pct(b)}</s>
      </>
    ) : (
      <>{pct(b)}</>
    );

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width) return;
    setHoverT(Math.round(clampN(((e.clientX - r.left) / r.width) * (nY - 1), 0, nY - 1)));
  };

  return (
    <div className="py-2 border-b border-slate-200 dark:border-slate-800 last:border-b-0 grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:gap-x-3 items-start">
      <div className="text-[13px] leading-tight">
        <span className="font-semibold text-slate-800 dark:text-white block">{node.label}</span>
        <span className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
          by {midYear} {num(base[tMid], cur[tMid])} · by {endYear} {num(base[tEnd], cur[tEnd])}
        </span>
      </div>

      <div className="relative mt-1 sm:mt-0">
        <svg
          viewBox={`0 0 ${LW} ${LH}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${node.label}: likelihood by year, ${pct(cur[tEnd])} by ${endYear}`}
          className="block w-full rounded-md"
          style={{ height: LH, background: 'var(--fx-surface)', touchAction: 'pan-y' }}
          onPointerMove={onPointer}
          onPointerLeave={() => setHoverT(null)}
        >
          <line x1={0} y1={ys(0.5)} x2={LW} y2={ys(0.5)} stroke="var(--fx-grid)" vectorEffect="non-scaling-stroke" />
          <path d={areaOf(base)} fill={color} opacity={0.22} />
          <path d={pathOf(cur)} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          {hoverT !== null && (
            <line
              x1={xs(hoverT, nY)}
              x2={xs(hoverT, nY)}
              y1={0}
              y2={LH}
              stroke="var(--fx-ink2)"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {hoverT !== null && (
          <span
            className="absolute top-0.5 right-1.5 text-[11px] tabular-nums px-1 rounded pointer-events-none"
            style={{ background: 'var(--fx-surface)', color: 'var(--fx-ink2)' }}
          >
            {years[hoverT]}: {pct(cur[hoverT], 1)}
          </span>
        )}

        <input
          type="range"
          className="w-full h-11 mt-0.5"
          min={-3}
          max={3}
          step={0.25}
          value={value}
          aria-label={`Nudge ${node.label} in log-odds, -3 to 3`}
          onChange={(e) => onChange(node.id, Number(e.target.value))}
        />

        <details className="mt-0.5">
          <summary className="cursor-pointer select-none text-[11px] text-slate-500 dark:text-slate-400 min-h-11 flex items-center">
            details{value !== 0 ? ` · nudged ${value > 0 ? '+' : ''}${value} log-odds` : ''}
          </summary>
          <div className="mt-1.5 space-y-2 text-[12px] text-slate-600 dark:text-slate-300">
            <p>{node.summary}</p>
            {node.operationalisation && (
              <p>
                <span className="font-semibold text-slate-700 dark:text-slate-200">Resolves as: </span>
                {node.operationalisation}
              </p>
            )}
            {node.narrative && <p className="italic text-slate-500 dark:text-slate-400">{node.narrative}</p>}

            <div>
              <span className="inline-block text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 mr-1.5">
                Seed
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {node.seed.basis} · confidence {node.seed.confidence}
                {node.seed.asOf ? ` · as of ${node.seed.asOf}` : ''}
              </span>
              {node.seed.sources && node.seed.sources.length > 0 && (
                <ul className="mt-1 space-y-0.5 list-disc list-inside">
                  {node.seed.sources.map((s, i) => (
                    <li key={i} className="text-slate-500 dark:text-slate-400">
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 underline">
                          {s.label}
                        </a>
                      ) : (
                        s.label
                      )}
                      <span className="text-slate-400 dark:text-slate-500"> ({s.kind}{s.value ? `, ${s.value}` : ''})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {node.parents && node.parents.length > 0 && (
              <div>
                <div className="font-semibold text-slate-700 dark:text-slate-200">Influenced by</div>
                <ul className="mt-0.5 space-y-0.5">
                  {node.parents.map((e, i) => (
                    <li key={i} className="text-slate-500 dark:text-slate-400">
                      <span className="tabular-nums">
                        {nodesById.get(e.from)?.label ?? e.from} — {e.kind} {e.strength >= 0 ? '+' : ''}
                        {e.strength}
                        {e.lag ? `, lag ${e.lag}y` : ''}
                      </span>
                      : {e.note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
};

export default NodeLane;

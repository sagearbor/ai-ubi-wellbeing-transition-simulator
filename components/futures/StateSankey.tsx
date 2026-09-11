/**
 * StateSankey — the same data as the river, drawn discretely (design doc section 9).
 *
 * One column per axis horizon (plus the start year), world-states ordered best-first
 * top to bottom, ribbon width proportional to the probability mass moving between them
 * under the engine's deterministic minimal-movement coupling. Because the states are
 * exclusive and sum to 1, this is the one place a Sankey is honest.
 *
 * Hand-rolled: no Sankey library, ~80 lines of layout.
 */

import React, { useMemo, useState } from 'react';
import { FuturesGraph, StateFlow } from '../../src/futures/types';
import { stateFlows } from '../../src/futures/engine';
import { colorVarOf, orderedStates, pct } from './GoodnessRiver';

export interface StateSankeyProps {
  graph: FuturesGraph;
  years: number[];
  P: Record<string, number[]>;
  defaultOpen?: boolean;
}

const SW = 640;
const ML = 108;
const MR = 40;
const TOP = 26;
const BOTTOM = 10;
const PLOT_H = 216;
const GAP = 6;
const NODE_W = 11;

const StateSankey: React.FC<StateSankeyProps> = ({ graph, years, P, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const states = useMemo(() => orderedStates(graph), [graph]);

  const layout = useMemo(() => {
    const columnYears = [graph.startYear, ...graph.axis.horizons.filter((h) => h > graph.startYear && h <= graph.endYear)];
    const n = states.length;
    const avail = Math.max(20, PLOT_H - GAP * Math.max(0, n - 1));
    const colX = columnYears.map((_, k) =>
      columnYears.length > 1 ? ML + (k / (columnYears.length - 1)) * (SW - ML - MR - NODE_W) : ML,
    );

    // node boxes: for each column, state -> {y0, y1}
    const boxes = columnYears.map((y) => {
      const t = years.indexOf(y);
      const out: Record<string, { y0: number; y1: number; p: number }> = {};
      let cursor = TOP;
      for (const s of states) {
        const p = t >= 0 ? P[s.id]?.[t] ?? 0 : 0;
        const h = p * avail;
        out[s.id] = { y0: cursor, y1: cursor + h, p };
        cursor += h + GAP;
      }
      return out;
    });

    const order = new Map<string, number>(states.map((s, i): [string, number] => [s.id, i]));
    const flows: StateFlow[] = stateFlows(graph, P, years);

    // Assign each flow a slot on its source node and its target node. Sorting by the
    // partner's rank keeps ribbons from crossing more than they must.
    const bands: Array<{ key: string; d: string; fill: string; title: string; mass: number }> = [];
    for (let k = 0; k < columnYears.length - 1; k++) {
      const y0 = columnYears[k];
      const y1 = columnYears[k + 1];
      const seg = flows.filter((f) => f.fromYear === y0 && f.toYear === y1 && f.mass > 1e-9);
      const srcCursor: Record<string, number> = {};
      const dstCursor: Record<string, number> = {};
      const outgoing = seg
        .slice()
        .sort((a, b) => (order.get(a.from)! - order.get(b.from)!) || (order.get(a.to)! - order.get(b.to)!));
      const placed = new Map<StateFlow, { a0: number; a1: number }>();
      for (const f of outgoing) {
        const box = boxes[k][f.from];
        if (!box) continue;
        const start = box.y0 + (srcCursor[f.from] ?? 0);
        const h = f.mass * avail;
        srcCursor[f.from] = (srcCursor[f.from] ?? 0) + h;
        placed.set(f, { a0: start, a1: start + h });
      }
      const incoming = seg
        .slice()
        .sort((a, b) => (order.get(a.to)! - order.get(b.to)!) || (order.get(a.from)! - order.get(b.from)!));
      for (const f of incoming) {
        const src = placed.get(f);
        const box = boxes[k + 1][f.to];
        if (!src || !box) continue;
        const start = box.y0 + (dstCursor[f.to] ?? 0);
        const h = f.mass * avail;
        dstCursor[f.to] = (dstCursor[f.to] ?? 0) + h;
        const x0 = colX[k] + NODE_W;
        const x1 = colX[k + 1];
        const mid = (x0 + x1) / 2;
        const d =
          `M${x0.toFixed(1)},${src.a0.toFixed(1)} ` +
          `C${mid.toFixed(1)},${src.a0.toFixed(1)} ${mid.toFixed(1)},${start.toFixed(1)} ${x1.toFixed(1)},${start.toFixed(1)} ` +
          `L${x1.toFixed(1)},${(start + h).toFixed(1)} ` +
          `C${mid.toFixed(1)},${(start + h).toFixed(1)} ${mid.toFixed(1)},${src.a1.toFixed(1)} ${x0.toFixed(1)},${src.a1.toFixed(1)} Z`;
        const fromNode = states.find((s) => s.id === f.from)!;
        const toNode = states.find((s) => s.id === f.to)!;
        bands.push({
          key: `${y0}-${f.from}-${f.to}`,
          d,
          fill: colorVarOf(f.from === f.to ? fromNode : toNode),
          title: `${fromNode.label} ${y0} → ${toNode.label} ${y1}: ${pct(f.mass, 1)}`,
          mass: f.mass,
        });
      }
    }

    return { columnYears, colX, boxes, bands };
  }, [graph, years, P, states]);

  const height = TOP + PLOT_H + BOTTOM + 12;

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl"
    >
      <summary className="cursor-pointer select-none px-4 sm:px-5 py-3 min-h-11 flex items-center text-sm font-bold text-slate-800 dark:text-white">
        Flow between world-states
        <span className="ml-2 font-normal text-[11px] text-slate-500 dark:text-slate-400">
          {layout.columnYears.join(' → ')}
        </span>
      </summary>
      <div className="px-4 sm:px-5 pb-4">
        <svg
          viewBox={`0 0 ${SW} ${height}`}
          role="img"
          aria-label="Sankey diagram of probability mass flowing between world-states across the axis horizons"
          className="block w-full h-auto rounded-xl"
          style={{ background: 'var(--fx-surface)' }}
        >
          {layout.columnYears.map((y, k) => (
            <text key={`hy-${y}`} x={layout.colX[k] + NODE_W / 2} y={16} textAnchor="middle" fontSize={11} fill="var(--fx-muted)">
              {y}
            </text>
          ))}

          {layout.bands.map((b) => (
            <path key={b.key} d={b.d} fill={b.fill} opacity={0.32}>
              <title>{b.title}</title>
            </path>
          ))}

          {layout.columnYears.map((y, k) =>
            states.map((s) => {
              const box = layout.boxes[k][s.id];
              if (!box) return null;
              const h = Math.max(1.5, box.y1 - box.y0);
              return (
                <g key={`node-${y}-${s.id}`}>
                  <rect x={layout.colX[k]} y={box.y0} width={NODE_W} height={h} fill={colorVarOf(s)} rx={2}>
                    <title>{`${s.label} in ${y}: ${pct(box.p, 1)}`}</title>
                  </rect>
                  {k === 0 && (
                    <text x={ML - 8} y={box.y0 + h / 2 + 4} textAnchor="end" fontSize={11} fill="var(--fx-ink2)">
                      {s.shortLabel ?? s.label}
                    </text>
                  )}
                  {h >= 11 && (
                    <text
                      x={layout.colX[k] + NODE_W + 3}
                      y={box.y0 + h / 2 + 4}
                      fontSize={11}
                      fill="var(--fx-muted)"
                    >
                      {pct(box.p)}
                    </text>
                  )}
                </g>
              );
            }),
          )}
        </svg>
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          Flows are the engine's deterministic minimal-movement coupling — absorbing states keep their mass,
          the rest is matched north-west-corner style over states sorted by goodness. Never voted on.
        </p>
      </div>
    </details>
  );
};

export default StateSankey;

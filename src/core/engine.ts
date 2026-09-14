/**
 * Authoring core — engine. Pure, deterministic, no I/O.
 *
 * resolveModel  : base model + overlays -> one model (+ diagnostics). Overlays add; they never
 *                 replace an existing equation (that is a structural fork).
 * compileModel  : expressions -> one expanded dependency graph over (entity, node) pairs plus
 *                 aggregate nodes; topological order; cycle traces; unknown symbols; unit checks.
 * runModel      : step t = 0..N. Inputs interpolated at the calendar year; variables evaluated in
 *                 order; stocks take `initial` at t = 0; lags read frozen earlier steps or declared
 *                 history; effects compose (sum of adds, then product of multiplies) on hooks;
 *                 solve blocks find a scalar root by bisection and fail explicitly; min()/max()
 *                 calls record which argument bound each step (the "why doesn't more money help"
 *                 explanation).
 * runMonteCarlo : ranged parameters sampled once per run with streams keyed by (seed, parameter id,
 *                 run) so baseline and variant draws are paired; quantiles per series.
 * runTests      : the model's own reproduction tests.
 */

import { create, all, type MathNode } from 'mathjs';
import type {
  BindingRecord,
  CoreModel,
  Diagnostic,
  Effect,
  Input,
  ModelTest,
  MonteCarloResult,
  Overlay,
  Parameter,
  Range,
  RunManifest,
  RunResult,
  SolveBlock,
  SolveRecord,
  TestOutcome,
  Variable,
} from './types';

export const ENGINE_VERSION = 'core-0.1.0';
const SINGLE = '_';

// ---------------------------------------------------------------------------
// mathjs instance with an allowlist
// ---------------------------------------------------------------------------

const math = create(all, {});
math.import(
  {
    logit: (p: number) => {
      const q = Math.min(0.999999, Math.max(0.000001, p));
      return Math.log(q / (1 - q));
    },
    sigmoid: (x: number) => 1 / (1 + Math.exp(-x)),
    clamp: (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x)),
  },
  { override: true },
);

const ALLOWED_FUNCTIONS = new Set([
  'min', 'max', 'abs', 'exp', 'log', 'log10', 'sqrt', 'pow', 'floor', 'ceil', 'round',
  'logit', 'sigmoid', 'clamp', 'sum', 'mean',
]);
const AGGREGATE_FUNCTIONS = new Set(['sum', 'mean', 'min', 'max']);
const RESERVED = new Set(['t', 'year', 'true', 'false', 'pi', 'e']);

// ---------------------------------------------------------------------------
// Expressions
// ---------------------------------------------------------------------------

interface ParsedExpr {
  source: string;
  /** Rewritten source with lags and aggregates as synthetic symbols. */
  rewritten: string;
  compiled: { evaluate: (scope: Record<string, number>) => number };
  /** Plain symbols referenced (parameters, inputs, variables, solve unknowns). */
  symbols: Set<string>;
  /** Lag references: symbol -> set of lag depths. */
  lags: Map<string, Set<number>>;
  /** Aggregate references: synthetic symbol -> { fn, variable }. */
  aggregates: Map<string, { fn: string; variable: string }>;
  /** min/max calls with two or more arguments, for binding diagnostics. */
  bindingCalls: Array<{ fn: 'min' | 'max'; args: string[]; compiledArgs: Array<{ evaluate: (s: Record<string, number>) => number }> }>;
  error?: string;
}

const LAG_RE = /\b([A-Za-z_]\w*)\s*\[\s*t\s*-\s*(\d+)\s*\]/g;

function parseExpr(source: string): ParsedExpr {
  const lags = new Map<string, Set<number>>();
  const aggregates = new Map<string, { fn: string; variable: string }>();
  const symbols = new Set<string>();
  const bindingCalls: ParsedExpr['bindingCalls'] = [];
  let rewritten = source.replace(LAG_RE, (_m, name: string, k: string) => {
    const depth = Number(k);
    if (!lags.has(name)) lags.set(name, new Set());
    lags.get(name)!.add(depth);
    return `${name}__lag${depth}`;
  });
  let node: MathNode;
  try {
    node = math.parse(rewritten);
  } catch (e) {
    return { source, rewritten, compiled: { evaluate: () => NaN }, symbols, lags, aggregates, bindingCalls, error: (e as Error).message };
  }
  let error: string | undefined;
  // Rewrite aggregate calls sum(x)/mean(x)/min(x)/max(x) (single symbol argument) into synthetic symbols.
  const transformed = node.transform((n: MathNode) => {
    if (n.type === 'FunctionNode') {
      const fn = (n as any).fn?.name as string;
      const args = (n as any).args as MathNode[];
      if (!ALLOWED_FUNCTIONS.has(fn)) {
        error = `function "${fn}" is not allowed`;
        return n;
      }
      if (AGGREGATE_FUNCTIONS.has(fn) && args.length === 1 && args[0].type === 'SymbolNode') {
        const v = (args[0] as any).name as string;
        const key = `__agg_${fn}_${v}`;
        aggregates.set(key, { fn, variable: v });
        return new (math as any).SymbolNode(key);
      }
      if ((fn === 'min' || fn === 'max') && args.length >= 2) {
        bindingCalls.push({
          fn,
          args: args.map((a) => a.toString()),
          compiledArgs: args.map((a) => a.compile()),
        });
      }
    } else if (n.type === 'AssignmentNode' || n.type === 'BlockNode' || n.type === 'ObjectNode' || n.type === 'FunctionAssignmentNode' || n.type === 'AccessorNode' || n.type === 'IndexNode' || n.type === 'ArrayNode') {
      error = `${n.type} is not allowed (use x[t-1] for lags)`;
    } else if (n.type === 'ConstantNode' && typeof (n as any).value === 'string') {
      error = 'string constants are not allowed';
    }
    return n;
  });
  transformed.traverse((n: MathNode, _path: string, parent: MathNode | null) => {
    if (n.type === 'SymbolNode') {
      const name = (n as any).name as string;
      const isFnName = parent && parent.type === 'FunctionNode' && (parent as any).fn === n;
      if (isFnName) return;
      if (name.includes('__lag') || name.startsWith('__agg_') || RESERVED.has(name)) return;
      symbols.add(name);
    }
  });
  rewritten = transformed.toString();
  return { source, rewritten, compiled: transformed.compile(), symbols, lags, aggregates, bindingCalls, error };
}

// ---------------------------------------------------------------------------
// Resolve overlays
// ---------------------------------------------------------------------------

export function resolveModel(base: CoreModel, overlays: Overlay[] = []): { model: CoreModel; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const model: CoreModel = JSON.parse(JSON.stringify(base));
  model.inputs = model.inputs ?? [];
  model.effects = model.effects ?? [];
  model.solves = model.solves ?? [];
  model.tests = model.tests ?? [];
  for (const o of overlays) {
    for (const p of o.parameters ?? []) {
      const existing = model.parameters.find((x) => x.id === p.id);
      if (existing) Object.assign(existing, p);
      else if (p.value !== undefined && p.source) model.parameters.push(p as Parameter);
      else diagnostics.push({ level: 'error', code: 'missing-source', message: `overlay ${o.id}: new parameter "${p.id}" needs value and source`, where: p.id });
    }
    for (const i of o.inputs ?? []) {
      const idx = model.inputs.findIndex((x) => x.id === i.id);
      if (idx >= 0) model.inputs[idx] = i;
      else model.inputs.push(i);
    }
    for (const v of o.variables ?? []) {
      if (model.variables.some((x) => x.id === v.id)) {
        diagnostics.push({ level: 'error', code: 'structural-change', message: `overlay ${o.id} redefines variable "${v.id}"; replacing an equation is a structural fork, not an overlay. Attach an effect instead.`, where: v.id });
      } else model.variables.push(v);
    }
    for (const e of o.effects ?? []) {
      if (model.effects.some((x) => x.id === e.id)) diagnostics.push({ level: 'error', code: 'duplicate-id', message: `overlay ${o.id}: effect "${e.id}" already exists (an effect applied twice is a double count)`, where: e.id });
      else model.effects.push(e);
    }
    for (const s of o.solves ?? []) {
      if (model.solves.some((x) => x.id === s.id)) diagnostics.push({ level: 'error', code: 'duplicate-id', message: `overlay ${o.id}: solve "${s.id}" already exists`, where: s.id });
      else model.solves.push(s);
    }
    for (const out of o.outputs ?? []) if (!model.outputs.includes(out)) model.outputs.push(out);
    for (const t of o.tests ?? []) model.tests.push(t);
  }
  return { model, diagnostics };
}

// ---------------------------------------------------------------------------
// Compile: one expanded dependency graph
// ---------------------------------------------------------------------------

type NodeKind = 'variable' | 'solve' | 'aggregate';

interface PlanNode {
  key: string; // `${entity}:${id}` or `agg:${fn}:${var}`
  kind: NodeKind;
  entity: string;
  id: string;
  deps: Set<string>;
}

export interface CompiledModel {
  model: CoreModel;
  entities: string[];
  years: number[];
  order: PlanNode[];
  variables: Map<string, { def: Variable; expr: ParsedExpr; initial?: ParsedExpr; effects: Array<{ def: Effect; expr: ParsedExpr }> }>;
  /** `through`: variable ids re-evaluated inside each bisection step, in dependency order. */
  solves: Map<string, { def: SolveBlock; expr: ParsedExpr; through: string[] }>;
  aggregates: Map<string, { fn: string; variable: string }>;
  tests: Array<{ def: ModelTest; expr: ParsedExpr }>;
  diagnostics: Diagnostic[];
}

function yearsOf(model: CoreModel): number[] {
  const perYear = model.time.step === 'month' ? 12 : 1;
  const n = (model.time.end - model.time.start) * perYear;
  const out: number[] = [];
  for (let t = 0; t <= n; t++) out.push(model.time.start + t / perYear);
  return out;
}

export function compileModel(model: CoreModel): CompiledModel {
  const diagnostics: Diagnostic[] = [];
  const entities = model.entities?.ids?.length ? [...model.entities.ids] : [SINGLE];
  const years = yearsOf(model);
  const paramIds = new Set(model.parameters.map((p) => p.id));
  const inputIds = new Set((model.inputs ?? []).map((i) => i.id));
  const varIds = new Set(model.variables.map((v) => v.id));
  const solveByUnknown = new Map((model.solves ?? []).map((s) => [s.unknown, s]));

  // duplicate ids and missing sources
  const seen = new Map<string, string>();
  const claim = (id: string, what: string) => {
    if (seen.has(id)) diagnostics.push({ level: 'error', code: 'duplicate-id', message: `"${id}" is declared as both ${seen.get(id)} and ${what}`, where: id });
    else seen.set(id, what);
  };
  model.parameters.forEach((p) => {
    claim(p.id, 'parameter');
    if (!p.source?.label) diagnostics.push({ level: 'error', code: 'missing-source', message: `parameter "${p.id}" has no source; mark it {kind:"guess"} if it is one`, where: p.id });
  });
  (model.inputs ?? []).forEach((i) => claim(i.id, 'input'));
  model.variables.forEach((v) => claim(v.id, 'variable'));
  (model.solves ?? []).forEach((s) => { claim(s.unknown, `solve unknown (${s.id})`); claim(`solve:${s.id}`, 'solve block'); });
  // Effect ids are claimed too: the same effect declared twice in one file is a silent double count.
  (model.effects ?? []).forEach((e) => claim(`effect:${e.id}`, 'effect'));

  const variables: CompiledModel['variables'] = new Map();
  const solves: CompiledModel['solves'] = new Map();
  const aggregates: CompiledModel['aggregates'] = new Map();
  const effectsByTarget = new Map<string, Array<{ def: Effect; expr: ParsedExpr }>>();

  const check = (expr: ParsedExpr, where: string) => {
    if (expr.error) diagnostics.push({ level: 'error', code: 'parse', message: `${where}: ${expr.error}`, where });
    for (const s of expr.symbols) {
      if (!paramIds.has(s) && !inputIds.has(s) && !varIds.has(s) && !solveByUnknown.has(s)) {
        diagnostics.push({ level: 'error', code: 'unknown-symbol', message: `${where}: "${s}" is not a parameter, input, variable or solve unknown`, where });
      }
    }
    for (const [sym] of expr.lags) {
      if (!inputIds.has(sym) && !varIds.has(sym)) diagnostics.push({ level: 'error', code: 'unknown-symbol', message: `${where}: lagged "${sym}" is not an input or variable`, where });
    }
    for (const [key, agg] of expr.aggregates) {
      if (!varIds.has(agg.variable) && !inputIds.has(agg.variable)) diagnostics.push({ level: 'error', code: 'unknown-symbol', message: `${where}: aggregate over unknown "${agg.variable}"`, where });
      aggregates.set(key, agg);
    }
  };

  for (const e of model.effects ?? []) {
    const target = model.variables.find((v) => v.id === e.target);
    if (!target) { diagnostics.push({ level: 'error', code: 'unknown-symbol', message: `effect "${e.id}" targets unknown variable "${e.target}"`, where: e.id }); continue; }
    if (target.hook === false) diagnostics.push({ level: 'error', code: 'no-hook', message: `effect "${e.id}": variable "${e.target}" does not accept effects`, where: e.id });
    if (e.op === 'add' && e.unit && target.unit && e.unit !== target.unit) diagnostics.push({ level: 'error', code: 'unit-mismatch', message: `effect "${e.id}" adds ${e.unit} to "${e.target}" which is in ${target.unit}`, where: e.id });
    if (e.op === 'multiply' && e.unit && e.unit !== '' && e.unit !== 'ratio' && e.unit !== '1') diagnostics.push({ level: 'warning', code: 'unit-mismatch', message: `effect "${e.id}" multiplies but declares unit ${e.unit}; a multiplier should be dimensionless`, where: e.id });
    if (!e.source?.label) diagnostics.push({ level: 'error', code: 'missing-source', message: `effect "${e.id}" has no source`, where: e.id });
    const expr = parseExpr(e.expr);
    check(expr, `effect ${e.id}`);
    if (!effectsByTarget.has(e.target)) effectsByTarget.set(e.target, []);
    effectsByTarget.get(e.target)!.push({ def: e, expr });
  }

  for (const v of model.variables) {
    const expr = parseExpr(v.equation);
    check(expr, `variable ${v.id}`);
    let initial: ParsedExpr | undefined;
    if (typeof v.initial === 'string') { initial = parseExpr(v.initial); check(initial, `variable ${v.id} initial`); }
    // A zero-lag self reference is a cycle; own lag is fine (stock).
    if (expr.symbols.has(v.id)) diagnostics.push({ level: 'error', code: 'cycle', message: `variable "${v.id}" references itself at the same step; use ${v.id}[t-1] for a stock`, where: v.id });
    variables.set(v.id, { def: v, expr, initial, effects: effectsByTarget.get(v.id) ?? [] });
  }
  for (const s of model.solves ?? []) {
    const expr = parseExpr(s.residual);
    check(expr, `solve ${s.id}`);
    const through = s.through ?? [];
    const throughSet = new Set(through);
    for (const id of through) {
      const v = model.variables.find((x) => x.id === id);
      if (!v) diagnostics.push({ level: 'error', code: 'unknown-symbol', message: `solve "${s.id}": through variable "${id}" is not a variable`, where: s.id });
      else if (v.initial !== undefined) diagnostics.push({ level: 'error', code: 'parse', message: `solve "${s.id}": through variable "${id}" is a stock (has "initial"); only same-step variables can be solved through`, where: s.id });
    }
    // Order the through variables so each is evaluated after the through variables it reads.
    const ordered: string[] = [];
    const pending = through.filter((id) => varIds.has(id));
    while (pending.length) {
      const i = pending.findIndex((id) => [...variables.get(id)?.expr.symbols ?? []].every((sym) => !throughSet.has(sym) || sym === id || ordered.includes(sym)));
      if (i < 0) { diagnostics.push({ level: 'error', code: 'cycle', message: `solve "${s.id}": through variables reference each other in a cycle (${pending.join(', ')})`, where: s.id }); break; }
      ordered.push(pending.splice(i, 1)[0]);
    }
    const reaches = through.length > 0 && [...throughSet].some((id) => expr.symbols.has(id));
    if (!expr.symbols.has(s.unknown) && !reaches) diagnostics.push({ level: 'error', code: 'parse', message: `solve "${s.id}": residual does not reference its unknown "${s.unknown}"`, where: s.id });
    solves.set(s.id, { def: s, expr, through: ordered });
  }
  const tests = (model.tests ?? []).map((t) => { const expr = parseExpr(t.expr); check(expr, `test ${t.name}`); return { def: t, expr }; });

  // Build the expanded graph.
  const nodes = new Map<string, PlanNode>();
  const depsOf = (expr: ParsedExpr, entity: string): string[] => {
    const out: string[] = [];
    for (const s of expr.symbols) {
      if (varIds.has(s)) out.push(`${entity}:${s}`);
      else if (solveByUnknown.has(s)) out.push(`${entity}:solve:${solveByUnknown.get(s)!.id}`);
    }
    for (const [key] of expr.aggregates) out.push(key);
    return out;
  };
  for (const entity of entities) {
    for (const [id, v] of variables) {
      const deps = new Set(depsOf(v.expr, entity));
      for (const ef of v.effects) depsOf(ef.expr, entity).forEach((d) => deps.add(d));
      nodes.set(`${entity}:${id}`, { key: `${entity}:${id}`, kind: 'variable', entity, id, deps });
    }
    for (const [id, s] of solves) {
      // A solve reads its through variables' own inputs directly; the through variables themselves
      // are evaluated inside the bisection (and again, at the root, as ordinary nodes afterwards).
      const inner = new Set(s.through.map((v) => `${entity}:${v}`));
      const raw = depsOf(s.expr, entity);
      for (const v of s.through) {
        const cv = variables.get(v)!;
        raw.push(...depsOf(cv.expr, entity));
        for (const ef of cv.effects) raw.push(...depsOf(ef.expr, entity));
      }
      const deps = new Set(raw.filter((d) => d !== `${entity}:solve:${id}` && !inner.has(d)));
      nodes.set(`${entity}:solve:${id}`, { key: `${entity}:solve:${id}`, kind: 'solve', entity, id, deps });
    }
  }
  for (const [key, agg] of aggregates) {
    const deps = new Set<string>();
    if (varIds.has(agg.variable)) for (const entity of entities) deps.add(`${entity}:${agg.variable}`);
    nodes.set(key, { key, kind: 'aggregate', entity: '*', id: agg.variable, deps });
  }

  // Topological sort with cycle trace.
  const order: PlanNode[] = [];
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const visit = (key: string): void => {
    const st = state.get(key) ?? 0;
    if (st === 2) return;
    if (st === 1) {
      const start = stack.indexOf(key);
      const trace = [...stack.slice(start), key].join(' -> ');
      diagnostics.push({ level: 'error', code: 'cycle', message: `same-step cycle: ${trace}. Break it with a lag (x[t-1]) or a solve block.`, where: key });
      return;
    }
    state.set(key, 1);
    stack.push(key);
    const node = nodes.get(key);
    if (node) for (const d of node.deps) if (nodes.has(d)) visit(d);
    stack.pop();
    state.set(key, 2);
    if (node) order.push(node);
  };
  for (const key of nodes.keys()) visit(key);

  // Effects on a variable that depends on a solve unknown, where the solve does not list the variable
  // in `through`: the effect is applied after the equilibrium, which is right only if the residual
  // is not meant to see it. Say so instead of leaving it silent.
  if (solves.size && entities.length) {
    const e0 = entities[0];
    const reachesSolve = (start: string, solveKey: string): boolean => {
      const seenK = new Set<string>();
      const walk = (k: string): boolean => {
        if (k === solveKey) return true;
        if (seenK.has(k)) return false;
        seenK.add(k);
        const n = nodes.get(k);
        return !!n && [...n.deps].some(walk);
      };
      return walk(start);
    };
    for (const [target, list] of effectsByTarget) {
      if (!varIds.has(target)) continue;
      for (const [sid, s] of solves) {
        if (s.through.includes(target)) continue;
        if (reachesSolve(`${e0}:${target}`, `${e0}:solve:${sid}`)) {
          for (const ef of list) diagnostics.push({ level: 'warning', code: 'effect-after-solve', message: `effect "${ef.def.id}" on "${target}" is applied after solve "${sid}" finds "${s.def.unknown}"; the equilibrium does not see it. If the residual should, list "${target}" in the solve's "through".`, where: ef.def.id });
        }
      }
    }
  }

  // Disconnected variables: not an output, not referenced by anything, not tested.
  const referenced = new Set<string>();
  for (const n of nodes.values()) for (const d of n.deps) referenced.add(d.split(':').slice(-1)[0]);
  for (const t of tests) t.expr.symbols.forEach((s) => referenced.add(s));
  for (const t of tests) for (const [sym] of t.expr.lags) referenced.add(sym);
  for (const v of model.variables) {
    const lagged = [...variables.values()].some((x) => x.expr.lags.has(v.id) || x.effects.some((e) => e.expr.lags.has(v.id)));
    if (!model.outputs.includes(v.id) && !referenced.has(v.id) && !lagged) {
      diagnostics.push({ level: 'warning', code: 'disconnected', message: `variable "${v.id}" is computed but nothing reads it and it is not an output`, where: v.id });
    }
  }
  for (const out of model.outputs) if (!varIds.has(out) && !inputIds.has(out) && !solveByUnknown.has(out)) diagnostics.push({ level: 'error', code: 'unknown-symbol', message: `output "${out}" is not a variable, input or solve unknown`, where: out });

  return { model, entities, years, order, variables, solves, aggregates, tests, diagnostics };
}

// ---------------------------------------------------------------------------
// Inputs and parameters
// ---------------------------------------------------------------------------

function interpolateInput(input: Input, entity: string, year: number, diagnostics: Diagnostic[], flagged: Set<string>): number {
  const curve = input.byEntity?.[entity] ?? input.curve;
  const keys = Object.keys(curve).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (keys.length === 0) return NaN;
  const k0 = keys[0];
  const k1 = keys[keys.length - 1];
  if (year < k0 || year > k1) {
    if ((input.outside ?? 'hold') === 'error') {
      if (!flagged.has(input.id)) { diagnostics.push({ level: 'error', code: 'input-out-of-range', message: `input "${input.id}" has no value for year ${year}`, where: input.id }); flagged.add(input.id); }
      return NaN;
    }
    return year < k0 ? curve[String(k0)] : curve[String(k1)];
  }
  // a = the last key at or before `year`; exact hits and the last key return the keyed value.
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1] <= year) i++;
  const a = keys[i];
  const b = keys[i + 1];
  if (b === undefined || year === a) return curve[String(a)];
  const f = (year - a) / (b - a);
  const va = curve[String(a)];
  const vb = curve[String(b)];
  switch (input.interp ?? 'linear') {
    case 'step': return va;
    case 'logodds': {
      const lg = (p: number) => { const q = Math.min(0.999999, Math.max(0.000001, p)); return Math.log(q / (1 - q)); };
      const x = (1 - f) * lg(va) + f * lg(vb);
      return 1 / (1 + Math.exp(-x));
    }
    default: return va + f * (vb - va);
  }
}

// Seeded RNG (mulberry32) keyed by (seed, parameter id, run) so draws are paired across variants.
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function normal01(rng: () => number): number {
  const u = Math.max(1e-12, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const Z95 = 1.6448536269514722;

export function sampleRange(range: Range, rng: () => number): number {
  switch (range.dist) {
    case 'uniform': return range.p5 + (rng() - 0.05) * ((range.p95 - range.p5) / 0.9);
    case 'normal': { const mu = (range.p5 + range.p95) / 2; const sd = (range.p95 - range.p5) / (2 * Z95); return mu + sd * normal01(rng); }
    case 'lognormal': { const lo = Math.log(Math.max(1e-12, range.p5)); const hi = Math.log(Math.max(1e-12, range.p95)); const mu = (lo + hi) / 2; const sd = (hi - lo) / (2 * Z95); return Math.exp(mu + sd * normal01(rng)); }
  }
}

function resolveParameters(model: CoreModel, entities: string[], seed: number | null, run: number): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const entity of entities) {
    out[entity] = {};
    for (const p of model.parameters) {
      let v = p.byEntity?.[entity] ?? p.value;
      if (seed !== null && p.range) {
        const rng = mulberry32((hashString(p.id) ^ (seed >>> 0)) + run * 0x9e3779b1);
        v = sampleRange(p.range, rng);
        if (p.byEntity?.[entity] !== undefined) v = v * (p.byEntity[entity] / p.value); // keep the entity's ratio to the base
      }
      if (p.bounds) v = Math.max(p.bounds[0], Math.min(p.bounds[1], v));
      out[entity][p.id] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export interface RunOptions {
  overlays?: Overlay[];
  /** null (default) = point values; a number samples every ranged parameter once for this run. */
  seed?: number | null;
  /** Monte Carlo run index; changes the draw. */
  run?: number;
}

function manifestFor(model: CoreModel, overlays: Overlay[], seed: number | null): RunManifest {
  const hash = hashString(JSON.stringify({ model, overlays, seed, ENGINE_VERSION })).toString(16).padStart(8, '0');
  return { modelId: model.id, overlayIds: overlays.map((o) => o.id), hash, seed, engineVersion: ENGINE_VERSION, createdAt: new Date().toISOString() };
}

export function runModel(base: CoreModel, opts: RunOptions = {}): RunResult {
  const overlays = opts.overlays ?? [];
  const seed = opts.seed ?? null;
  const { model, diagnostics: d0 } = resolveModel(base, overlays);
  const cm = compileModel(model);
  const diagnostics = [...d0, ...cm.diagnostics];
  const manifest = manifestFor(base, overlays, seed);
  const empty: RunResult = { ok: false, diagnostics, years: cm.years, series: {}, aggregates: {}, binding: {}, solves: {}, parameters: {}, manifest };
  if (diagnostics.some((d) => d.level === 'error')) return empty;

  const { entities, years, order } = cm;
  const nY = years.length;
  const params = resolveParameters(model, entities, seed, opts.run ?? 0);
  const series: Record<string, Record<string, number[]>> = {};
  const aggregates: Record<string, number[]> = {};
  const binding: RunResult['binding'] = {};
  const solves: RunResult['solves'] = {};
  const flaggedInputs = new Set<string>();
  const inputs = model.inputs ?? [];

  for (const entity of entities) {
    series[entity] = {};
    binding[entity] = {};
    for (const p of model.parameters) series[entity][p.id] = new Array(nY).fill(params[entity][p.id]);
    for (const i of inputs) series[entity][i.id] = years.map((y) => interpolateInput(i, entity, y, diagnostics, flaggedInputs));
    for (const [id] of cm.variables) series[entity][id] = new Array(nY).fill(NaN);
    for (const [, s] of cm.solves) series[entity][s.def.unknown] = new Array(nY).fill(NaN);
    for (const [id, v] of cm.variables) if (v.expr.bindingCalls.length) binding[entity][id] = v.expr.bindingCalls.map((c) => ({ fn: c.fn, args: c.args, activeArg: new Array(nY).fill(-1) }));
  }
  for (const key of cm.aggregates.keys()) aggregates[key] = new Array(nY).fill(NaN);
  for (const [id] of cm.solves) { solves[id] = {}; for (const entity of entities) solves[id][entity] = { status: 'ok', iterations: new Array(nY).fill(0), residual: new Array(nY).fill(0) }; }

  const scopeFor = (entity: string, t: number, expr: ParsedExpr, extra?: Record<string, number>): Record<string, number> | null => {
    const s: Record<string, number> = { t, year: years[t], ...(extra ?? {}) };
    const es = series[entity];
    for (const sym of expr.symbols) if (s[sym] === undefined) s[sym] = es[sym]?.[t] ?? NaN;
    for (const [sym, depths] of expr.lags) {
      for (const k of depths) {
        const idx = t - k;
        let v: number;
        if (idx >= 0) v = es[sym][idx];
        else {
          const def = cm.variables.get(sym)?.def;
          const hist = def?.history;
          const hIdx = -idx - 1; // idx = -1 -> history[0]
          if (hist && hist[hIdx] !== undefined) v = hist[hIdx];
          else if (inputs.some((i) => i.id === sym)) v = interpolateInput(inputs.find((i) => i.id === sym)!, entity, years[0] + idx / (model.time.step === 'month' ? 12 : 1), diagnostics, flaggedInputs);
          else {
            diagnostics.push({ level: 'error', code: 'missing-history', message: `"${sym}[t-${k}]" at step ${t} needs history before the start; declare "history" on "${sym}"`, where: sym, entity, step: t });
            return null;
          }
        }
        s[`${sym}__lag${k}`] = v;
      }
    }
    for (const [key] of expr.aggregates) s[key] = aggregates[key][t];
    return s;
  };

  for (let t = 0; t < nY; t++) {
    for (const node of order) {
      if (node.kind === 'aggregate') {
        const agg = cm.aggregates.get(node.key)!;
        const vals = entities.map((e) => series[e][agg.variable][t]).filter((x) => Number.isFinite(x));
        let v = NaN;
        if (vals.length) {
          if (agg.fn === 'sum') v = vals.reduce((a, b) => a + b, 0);
          else if (agg.fn === 'mean') v = vals.reduce((a, b) => a + b, 0) / vals.length;
          else if (agg.fn === 'min') v = Math.min(...vals);
          else v = Math.max(...vals);
        }
        aggregates[node.key][t] = v;
        continue;
      }
      const entity = node.entity;
      if (node.kind === 'solve') {
        const s = cm.solves.get(node.id)!;
        const rec = solves[node.id][entity];
        const scope = scopeFor(entity, t, s.expr);
        if (!scope) return { ...empty, diagnostics };
        // Scopes for the through variables and their effects, built once; the unknown and the
        // through values are overlaid per bisection step.
        const inner = s.through.map((id) => {
          const cv = cm.variables.get(id)!;
          return {
            id,
            cv,
            scope: scopeFor(entity, t, cv.expr),
            effects: cv.effects.map((ef) => ({ ef, scope: scopeFor(entity, t, ef.expr) })),
          };
        });
        if (inner.some((x) => !x.scope || x.effects.some((e) => !e.scope))) return { ...empty, diagnostics };
        const f = (u: number) => {
          const vals: Record<string, number> = { [s.def.unknown]: u };
          for (const x of inner) {
            let value = x.cv.expr.compiled.evaluate({ ...x.scope!, ...vals });
            let add = 0;
            let mul = 1;
            for (const { ef, scope: es } of x.effects) {
              if (ef.def.from !== undefined && years[t] < ef.def.from) continue;
              const ev = ef.expr.compiled.evaluate({ ...es!, ...vals });
              if (ef.def.op === 'add') add += ev; else mul *= ev;
            }
            value = (value + add) * mul;
            vals[x.id] = value;
          }
          return s.expr.compiled.evaluate({ ...scope, ...vals });
        };
        let [lo, hi] = s.def.bracket;
        let flo = f(lo);
        let fhi = f(hi);
        const tol = s.def.tol ?? 1e-9;
        const maxIter = s.def.maxIter ?? 100;
        if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) {
          rec.status = 'no-root';
          diagnostics.push({ level: 'error', code: 'solve-no-root', message: `solve "${s.def.id}" (${entity}, step ${t}): residual has the same sign at both ends of the bracket [${lo}, ${hi}] (${flo.toPrecision(3)}, ${fhi.toPrecision(3)})`, where: s.def.id, entity, step: t });
          return { ...empty, diagnostics };
        }
        let mid = lo;
        let it = 0;
        for (; it < maxIter; it++) {
          mid = (lo + hi) / 2;
          const fm = f(mid);
          if (Math.abs(fm) <= tol || (hi - lo) / 2 <= tol * Math.max(1, Math.abs(mid))) { flo = fm; break; }
          if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
        }
        if (it >= maxIter) {
          rec.status = 'no-convergence';
          diagnostics.push({ level: 'error', code: 'solve-no-convergence', message: `solve "${s.def.id}" (${entity}, step ${t}) did not converge in ${maxIter} iterations`, where: s.def.id, entity, step: t });
          return { ...empty, diagnostics };
        }
        rec.iterations[t] = it;
        rec.residual[t] = f(mid);
        series[entity][s.def.unknown][t] = mid;
        continue;
      }
      const v = cm.variables.get(node.id)!;
      let value: number;
      if (t === 0 && v.def.initial !== undefined) {
        if (typeof v.def.initial === 'number') value = v.def.initial;
        else { const sc = scopeFor(entity, t, v.initial!); if (!sc) return { ...empty, diagnostics }; value = v.initial!.compiled.evaluate(sc); }
      } else {
        const scope = scopeFor(entity, t, v.expr);
        if (!scope) return { ...empty, diagnostics };
        value = v.expr.compiled.evaluate(scope);
        const b = binding[entity][node.id];
        if (b) v.expr.bindingCalls.forEach((call, ci) => {
          const vals = call.compiledArgs.map((c) => c.evaluate(scope));
          let best = 0;
          for (let i = 1; i < vals.length; i++) if (call.fn === 'min' ? vals[i] < vals[best] : vals[i] > vals[best]) best = i;
          b[ci].activeArg[t] = best;
        });
      }
      if (v.effects.length) {
        let add = 0;
        let mul = 1;
        for (const ef of v.effects) {
          if (ef.def.from !== undefined && years[t] < ef.def.from) continue;
          const sc = scopeFor(entity, t, ef.expr);
          if (!sc) return { ...empty, diagnostics };
          const ev = ef.expr.compiled.evaluate(sc);
          if (ef.def.op === 'add') add += ev; else mul *= ev;
        }
        value = (value + add) * mul;
      }
      if (!Number.isFinite(value)) {
        diagnostics.push({ level: 'error', code: 'non-finite', message: `variable "${node.id}" (${entity}, step ${t}) is ${value}`, where: node.id, entity, step: t });
        return { ...empty, diagnostics };
      }
      series[entity][node.id][t] = value;
    }
  }

  return { ok: true, diagnostics, years, series, aggregates, binding, solves, parameters: params, manifest };
}

// ---------------------------------------------------------------------------
// Monte Carlo and tests
// ---------------------------------------------------------------------------

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function runMonteCarlo(base: CoreModel, opts: { overlays?: Overlay[]; runs?: number; seed?: number } = {}): MonteCarloResult {
  const runs = opts.runs ?? 200;
  const seed = opts.seed ?? 1;
  const overlays = opts.overlays ?? [];
  const first = runModel(base, { overlays, seed, run: 0 });
  const manifest = { ...first.manifest, seed };
  if (!first.ok) return { ok: false, diagnostics: first.diagnostics, years: first.years, runs: 0, quantiles: {}, manifest };
  const all: RunResult[] = [first];
  for (let r = 1; r < runs; r++) {
    const res = runModel(base, { overlays, seed, run: r });
    if (!res.ok) return { ok: false, diagnostics: res.diagnostics, years: res.years, runs: r, quantiles: {}, manifest };
    all.push(res);
  }
  const quantiles: MonteCarloResult['quantiles'] = {};
  const { model } = resolveModel(base, overlays);
  const keys = new Set<string>([...model.outputs, ...model.variables.map((v) => v.id)]);
  for (const entity of Object.keys(first.series)) {
    quantiles[entity] = {};
    for (const key of keys) {
      if (!first.series[entity][key]) continue;
      const nY = first.years.length;
      const q = { p5: new Array(nY).fill(0), p25: new Array(nY).fill(0), p50: new Array(nY).fill(0), p75: new Array(nY).fill(0), p95: new Array(nY).fill(0), mean: new Array(nY).fill(0) };
      for (let t = 0; t < nY; t++) {
        const col = all.map((r) => r.series[entity][key][t]).sort((a, b) => a - b);
        q.p5[t] = quantile(col, 0.05); q.p25[t] = quantile(col, 0.25); q.p50[t] = quantile(col, 0.5); q.p75[t] = quantile(col, 0.75); q.p95[t] = quantile(col, 0.95);
        q.mean[t] = col.reduce((a, b) => a + b, 0) / col.length;
      }
      quantiles[entity][key] = q;
    }
  }
  return { ok: true, diagnostics: first.diagnostics, years: first.years, runs, quantiles, manifest };
}

/** Evaluate the model's own tests against a run. */
export function runTests(base: CoreModel, opts: RunOptions = {}): TestOutcome[] {
  const overlays = opts.overlays ?? [];
  const { model } = resolveModel(base, overlays);
  const cm = compileModel(model);
  const result = runModel(base, opts);
  return cm.tests.map(({ def, expr }) => {
    if (!result.ok) return { name: def.name, passed: false, actual: null, expected: def.expected, tol: def.tol, message: `run failed: ${result.diagnostics.map((d) => d.message).join('; ')}` };
    const entity = def.entity ?? cm.entities[0];
    const t = result.years.findIndex((y) => Math.abs(y - def.at) < 1e-9);
    if (t < 0) return { name: def.name, passed: false, actual: null, expected: def.expected, tol: def.tol, message: `year ${def.at} is not a step of this model` };
    const scope: Record<string, number> = { t, year: result.years[t] };
    for (const sym of expr.symbols) scope[sym] = result.series[entity]?.[sym]?.[t] ?? NaN;
    for (const [sym, depths] of expr.lags) for (const k of depths) scope[`${sym}__lag${k}`] = result.series[entity]?.[sym]?.[t - k] ?? NaN;
    for (const [key] of expr.aggregates) scope[key] = result.aggregates[key]?.[t] ?? NaN;
    const actual = expr.compiled.evaluate(scope);
    const passed = Number.isFinite(actual) && Math.abs(actual - def.expected) <= def.tol;
    return { name: def.name, passed, actual, expected: def.expected, tol: def.tol, message: passed ? `ok: ${actual} within ${def.tol} of ${def.expected}` : `got ${actual}, expected ${def.expected} ± ${def.tol}` };
  });
}

/** Plain-English binding explanation for a variable at a step, e.g. "placements is limited by suitable_openings". */
export function explainBinding(result: RunResult, entity: string, variable: string, t: number): string[] {
  const recs = result.binding[entity]?.[variable];
  if (!recs?.length) return [];
  return recs.map((r) => {
    const i = r.activeArg[t];
    if (i < 0) return `${variable}: ${r.fn}() not evaluated at step ${t}`;
    return `${variable} is ${r.fn === 'min' ? 'limited by' : 'floored by'} ${r.args[i]}`;
  });
}

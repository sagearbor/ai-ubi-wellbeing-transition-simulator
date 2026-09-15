/**
 * Source-clause inventory and coverage. Pure and deterministic: the denominator of "how much of the
 * text did this draft deal with" comes from the source text, never from the draft.
 *
 *   buildClauseInventory(text) -> clauses with stable ids ("sec4(c)(2)(B)(i)(I)")
 *   locateQuote(quote, text)   -> where a quote sits (every occurrence, in original offsets)
 *   sourceCoverage(draft, text) -> each substantive clause covered by a provision quote, explicitly
 *                                 excluded, or uncovered
 *
 * Legislative text is split on its own structure: "SEC. 4." / "SECTION 1." headings and the US
 * drafting hierarchy of subdivisions at the start of a line — (a) subsection, (1) paragraph,
 * (A) subparagraph, (i) clause, (I) subclause. A parenthesised label at the start of a line counts
 * only when the text before it ends a unit ("--", ".", ";", ":", "and", "or"), so a wrapped
 * cross-reference ("under paragraph\n (1) shall include") is not mistaken for structure. Lines of
 * quoted matter being inserted into another law (starting with ``) stay inside the clause that
 * inserts them. A segment that is only a heading ("(a) Grants Authorized.--") is a heading, not a
 * clause, and is not counted.
 *
 * Text without that structure falls back to paragraphs (blank lines), split into sentences.
 *
 * Coverage rules:
 *   - a clause is covered when a provision's quote occurs exactly once in the text and that
 *     occurrence overlaps the clause (a quote spanning several clauses covers each of them);
 *   - a quote that occurs more than once covers nothing (it is ambiguous: lengthen it);
 *   - a clause can instead be excluded, by id, with a kind and a reason;
 *   - without the source text, coverage is unknown, and says so.
 */

import { sha256Hex } from './hash';
import type { ClauseExclusion, PolicyDraft } from './types';

export const CLAUSE_INVENTORY_VERSION = 'clauses/1';

export interface SourceClause {
  id: string;
  /** Human label, e.g. "SEC. 4(c)(2)(B)(i)(I)" or "paragraph 2, sentence 1". */
  label: string;
  /** Offsets into the original text, [start, end). */
  start: number;
  end: number;
  text: string;
  /** A heading with no operative words of its own; not counted. */
  heading: boolean;
}

export interface ClauseInventory {
  version: string;
  structure: 'legislative' | 'paragraphs';
  clauses: SourceClause[];
}

type Level = 'lower-alpha' | 'digit' | 'upper-alpha' | 'lower-roman' | 'upper-roman';
const RANK: Record<Level, number> = { 'lower-alpha': 1, digit: 2, 'upper-alpha': 3, 'lower-roman': 4, 'upper-roman': 5 };

const ROMAN = /^(?=[ivxlc]+$)c{0,3}(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;

function romanValue(s: string): number {
  const v: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const a = v[s[i]];
    const b = v[s[i + 1]] ?? 0;
    total += a < b ? -a : a;
  }
  return total;
}

function alphaValue(s: string): number {
  // a..z, then aa, bb, ... (US Code style)
  if (!/^([a-z])\1*$/.test(s)) return NaN;
  return (s.length - 1) * 26 + (s.charCodeAt(0) - 96);
}

function ordinal(level: Level, label: string): number {
  switch (level) {
    case 'digit': return Number(label);
    case 'lower-alpha': return alphaValue(label);
    case 'upper-alpha': return alphaValue(label.toLowerCase());
    case 'lower-roman': return ROMAN.test(label) ? romanValue(label) : NaN;
    case 'upper-roman': return ROMAN.test(label.toLowerCase()) ? romanValue(label.toLowerCase()) : NaN;
  }
}

function candidates(label: string): Level[] {
  if (/^\d+$/.test(label)) return ['digit'];
  if (/^[a-z]+$/.test(label)) return [ROMAN.test(label) ? 'lower-roman' : null, Number.isFinite(alphaValue(label)) ? 'lower-alpha' : null].filter(Boolean) as Level[];
  if (/^[A-Z]+$/.test(label)) {
    const lower = label.toLowerCase();
    return [ROMAN.test(lower) ? 'upper-roman' : null, Number.isFinite(alphaValue(lower)) ? 'upper-alpha' : null].filter(Boolean) as Level[];
  }
  return [];
}

interface StackEntry { level: Level; label: string }

function chooseLevel(label: string, stack: StackEntry[]): Level | null {
  const cands = candidates(label);
  if (cands.length === 0) return null;
  if (cands.length === 1) return cands[0];
  const deepest = stack.length ? RANK[stack[stack.length - 1].level] : 0;
  const score = (lv: Level): number => {
    const n = ordinal(lv, label);
    const same = [...stack].reverse().find((e) => e.level === lv);
    if (same && ordinal(lv, same.label) + 1 === n) return 3; // the next sibling of an open level
    if (!same && n === 1 && RANK[lv] > deepest) return RANK[lv] === deepest + 1 ? 3 : 1; // first child (ties go to the deeper level)
    return 0;
  };
  const scored = cands.map((lv) => ({ lv, s: score(lv) })).sort((a, b) => b.s - a.s || RANK[b.lv] - RANK[a.lv]);
  if (scored[0].s > 0) return scored[0].lv;
  return cands.includes('lower-alpha') ? 'lower-alpha' : cands.includes('upper-alpha') ? 'upper-alpha' : cands[0];
}

const SECTION_RE = /^[ \t]*(?:SECTION|SEC\.|Sec\.|Section)[ \t]+(\d+[A-Za-z]?)\.(?=\s)/;
const SUBDIV_RE = /^[ \t]*\(([a-z]{1,4}|[A-Z]{1,4}|\d{1,3})\)[ \t]+(?!(?:of|through)\b)\S/;
const ENDS_UNIT = /(--|[.;:]|\band|\bor|'')\s*$/;

interface Marker { start: number; id: string; label: string; kind: 'section' | 'subdivision' }

function headingOnly(segment: string, kind: Marker['kind']): boolean {
  let body = segment.trim();
  if (kind === 'section') {
    body = body.replace(SECTION_RE, '').trim();
    // an all-caps title line, e.g. "GRANTS TO IMPROVE TRAINING."
    body = body.replace(/^[A-Z0-9][A-Z0-9 ,'’\-&]*\.(?=\s|$)/, '').trim();
  } else {
    body = body.replace(/^\([A-Za-z0-9]+\)/, '').trim();
    body = body.replace(/^[A-Z][^.\n]{0,120}?\.--/, '').trim();
  }
  return body.length === 0;
}

function legislativeMarkers(text: string): Marker[] {
  const markers: Marker[] = [];
  let section = '';
  let stack: StackEntry[] = [];
  const ids = new Map<string, number>();
  let offset = 0;
  const lines = text.split('\n');
  let previous = ''; // the last non-blank line so far, trimmed
  for (const line of lines) {
    const lineStart = offset;
    offset += line.length + 1;
    const before = previous;
    if (line.trim()) previous = line.trim();
    const sec = SECTION_RE.exec(line);
    if (sec) {
      section = sec[1];
      stack = [];
      const id = `sec${section}`;
      markers.push({ start: lineStart, id: unique(id, ids), label: `SEC. ${section}`, kind: 'section' });
      continue;
    }
    const sub = SUBDIV_RE.exec(line);
    if (!sub) continue;
    if (before.length > 0 && !ENDS_UNIT.test(before)) continue;
    const label = sub[1];
    const level = chooseLevel(label, stack);
    if (!level) continue;
    while (stack.length && RANK[stack[stack.length - 1].level] >= RANK[level]) stack.pop();
    stack.push({ level, label });
    const path = stack.map((e) => `(${e.label})`).join('');
    const id = `${section ? `sec${section}` : ''}${path}`;
    markers.push({ start: lineStart, id: unique(id, ids), label: `${section ? `SEC. ${section}` : ''}${path}`, kind: 'subdivision' });
  }
  return markers;
}

function unique(id: string, seen: Map<string, number>): string {
  const n = (seen.get(id) ?? 0) + 1;
  seen.set(id, n);
  return n === 1 ? id : `${id}~${n}`;
}

function paragraphClauses(text: string): SourceClause[] {
  const out: SourceClause[] = [];
  const paraRe = /\S[\s\S]*?(?=\n[ \t]*\n|$)/g;
  let m: RegExpExecArray | null;
  let p = 0;
  while ((m = paraRe.exec(text)) !== null) {
    if (!m[0].trim()) continue;
    p += 1;
    const paraStart = m.index;
    const para = m[0];
    const sentences: Array<[number, number]> = [];
    const endRe = /[.!?]["'”’)\]]*(?=\s+["“(]?[A-Z0-9])/g;
    let s = 0;
    let e: RegExpExecArray | null;
    while ((e = endRe.exec(para)) !== null) {
      const end = e.index + e[0].length;
      sentences.push([s, end]);
      s = end;
      while (s < para.length && /\s/.test(para[s])) s++;
    }
    if (s < para.length) sentences.push([s, para.length]);
    sentences.forEach(([a, b], j) => {
      const single = sentences.length === 1;
      out.push({
        id: single ? `p${p}` : `p${p}.s${j + 1}`,
        label: single ? `paragraph ${p}` : `paragraph ${p}, sentence ${j + 1}`,
        start: paraStart + a,
        end: paraStart + b,
        text: para.slice(a, b),
        heading: false,
      });
    });
    if (paraRe.lastIndex === m.index) paraRe.lastIndex++;
  }
  return out;
}

/** The deterministic clause inventory of a source text. */
export function buildClauseInventory(text: string): ClauseInventory {
  const src = String(text ?? '');
  const markers = legislativeMarkers(src);
  if (markers.length < 2) return { version: CLAUSE_INVENTORY_VERSION, structure: 'paragraphs', clauses: paragraphClauses(src) };
  const clauses: SourceClause[] = [];
  const first = markers[0].start;
  if (src.slice(0, first).trim()) {
    clauses.push({ id: 'preamble', label: 'text before the first section', start: 0, end: first, text: src.slice(0, first), heading: false });
  }
  markers.forEach((mk, i) => {
    const end = i + 1 < markers.length ? markers[i + 1].start : src.length;
    const segment = src.slice(mk.start, end);
    clauses.push({ id: mk.id, label: mk.label, start: mk.start, end, text: segment, heading: headingOnly(segment, mk.kind) });
  });
  return { version: CLAUSE_INVENTORY_VERSION, structure: 'legislative', clauses };
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

/** Every occurrence of `quote` in `text` after whitespace normalisation, as original [start, end). */
export function locateQuote(quote: string, text: string): Array<[number, number]> {
  const q = String(quote ?? '').replace(/\s+/g, ' ').trim();
  if (!q) return [];
  const src = String(text ?? '');
  let norm = '';
  const map: number[] = [];
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      if (norm.length && norm[norm.length - 1] !== ' ') {
        norm += ' ';
        map.push(i);
      }
    } else {
      norm += ch;
      map.push(i);
    }
  }
  const out: Array<[number, number]> = [];
  let from = 0;
  for (;;) {
    const at = norm.indexOf(q, from);
    if (at < 0) break;
    out.push([map[at], map[at + q.length - 1] + 1]);
    from = at + 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

export interface ClauseStatus {
  id: string;
  label: string;
  state: 'covered' | 'excluded' | 'covered-and-excluded' | 'uncovered';
  /** Provision ids whose quotes fall in this clause. */
  provisions: string[];
  exclusion?: ClauseExclusion;
}

export interface SourceCoverage {
  status: 'complete' | 'incomplete' | 'source-unavailable' | 'source-mismatch';
  inventoryVersion: string;
  structure?: ClauseInventory['structure'];
  /** Substantive clauses (headings not counted). */
  clauses: number;
  headings: number;
  covered: number;
  excluded: number;
  uncovered: string[];
  /** Provisions whose quote occurs more than once (covers nothing), or nowhere. */
  ambiguousQuotes: string[];
  unlocatedQuotes: string[];
  /** Exclusions naming a clause the inventory does not have. */
  unknownExclusions: string[];
  detail: ClauseStatus[];
  /** "57 of 57 source clauses covered or explicitly excluded" / "source unavailable — coverage unknown" */
  text: string;
}

export function sourceCoverage(draft: Pick<PolicyDraft, 'provisions' | 'exclusions' | 'source'>, sourceText?: string): SourceCoverage {
  const empty = (status: SourceCoverage['status'], text: string): SourceCoverage => ({
    status, inventoryVersion: CLAUSE_INVENTORY_VERSION, clauses: 0, headings: 0, covered: 0, excluded: 0, uncovered: [], ambiguousQuotes: [], unlocatedQuotes: [], unknownExclusions: [], detail: [], text,
  });
  if (typeof sourceText !== 'string' || !sourceText.trim()) return empty('source-unavailable', 'source unavailable — coverage unknown');
  if (draft.source?.textSha256 && sha256Hex(sourceText) !== draft.source.textSha256) {
    return empty('source-mismatch', 'source text differs from the text this draft pins — coverage unknown');
  }
  const inv = buildClauseInventory(sourceText);
  const substantive = inv.clauses.filter((c) => !c.heading);
  const byClause = new Map<string, Set<string>>(substantive.map((c) => [c.id, new Set<string>()]));
  const ambiguousQuotes: string[] = [];
  const unlocatedQuotes: string[] = [];
  for (const p of Array.isArray(draft.provisions) ? draft.provisions : []) {
    if (!p || typeof p.quote !== 'string' || !p.quote.trim()) continue;
    const spans = locateQuote(p.quote, sourceText);
    if (spans.length === 0) { unlocatedQuotes.push(String(p.id)); continue; }
    if (spans.length > 1) { ambiguousQuotes.push(String(p.id)); continue; }
    const [s, e] = spans[0];
    for (const c of substantive) if (c.start < e && s < c.end) byClause.get(c.id)!.add(String(p.id));
  }
  const exclusions = new Map<string, ClauseExclusion>();
  const unknownExclusions: string[] = [];
  const allIds = new Set(inv.clauses.map((c) => c.id));
  for (const x of Array.isArray(draft.exclusions) ? draft.exclusions : []) {
    if (!x || typeof x.clauseId !== 'string') continue;
    if (!allIds.has(x.clauseId)) unknownExclusions.push(String(x.clauseId));
    else if (!exclusions.has(x.clauseId)) exclusions.set(x.clauseId, x);
  }
  const detail: ClauseStatus[] = substantive.map((c) => {
    const provisions = [...byClause.get(c.id)!];
    const exclusion = exclusions.get(c.id);
    const state: ClauseStatus['state'] = provisions.length && exclusion ? 'covered-and-excluded' : provisions.length ? 'covered' : exclusion ? 'excluded' : 'uncovered';
    return { id: c.id, label: c.label, state, provisions, ...(exclusion ? { exclusion } : {}) };
  });
  const covered = detail.filter((d) => d.state === 'covered' || d.state === 'covered-and-excluded').length;
  const excluded = detail.filter((d) => d.state === 'excluded').length;
  const uncovered = detail.filter((d) => d.state === 'uncovered').map((d) => d.id);
  const n = substantive.length;
  return {
    status: uncovered.length === 0 && n > 0 ? 'complete' : 'incomplete',
    inventoryVersion: inv.version,
    structure: inv.structure,
    clauses: n,
    headings: inv.clauses.length - n,
    covered,
    excluded,
    uncovered,
    ambiguousQuotes,
    unlocatedQuotes,
    unknownExclusions,
    detail,
    text: `${covered + excluded} of ${n} source clause${n === 1 ? '' : 's'} covered or explicitly excluded (${covered} by a provision quote, ${excluded} excluded)`,
  };
}

/** Explicit bookkeeping, never a proof of semantic completeness or human review. */
export function operativeCoverage(draft: Partial<PolicyDraft>, sourceText?: string): import('./types').OperativeCoverage {
  const src = sourceCoverage({ provisions: draft.provisions ?? [], source: draft.source!, exclusions: draft.exclusions }, sourceText);
  const dispositions = Array.isArray(draft.clauseDispositions) ? draft.clauseDispositions : [];
  const unresolved = src.detail.filter(c => {
    const d = dispositions.find(x => x?.clauseId === c.id);
    return !d || (typeof d.reason !== 'string' || !d.reason.trim()) || d.status === 'unresolved' || !['linked','outside-model','not-operative'].includes(d.status) || (d.status === 'linked' && (!Array.isArray(d.provisionIds) || !d.provisionIds.length || d.provisionIds.some(id => !draft.provisions?.some(p => p.id === id && p.status !== 'unresolved'))));
  }).map(c => c.id);
  const outsideModel = src.detail.filter(c => {
    const d = dispositions.find(x => x?.clauseId === c.id);
    return d?.status === 'outside-model' || (d?.status === 'linked' && Array.isArray(d.provisionIds) && d.provisionIds.some(id => draft.provisions?.some(p => p.id === id && p.status === 'outside-model')));
  }).map(c => c.id);
  const accounted = src.detail.filter(c => {
    const ds = dispositions.filter(x => x?.clauseId === c.id);
    const d = ds[0];
    return ds.length === 1 && d && typeof d.reason === 'string' && !!d.reason.trim() && ['linked','unresolved','outside-model','not-operative'].includes(d.status) && (d.status !== 'linked' || (Array.isArray(d.provisionIds) && d.provisionIds.length > 0 && d.provisionIds.every(id => draft.provisions?.some(p => p.id === id))));
  }).length;
  return { clauses: src.clauses, accounted, unresolved, outsideModel, text: src.status === 'source-unavailable' || src.status === 'source-mismatch' ? 'Operative coverage unknown — source unavailable or mismatched' : `${accounted} of ${src.clauses} source clauses have explicit operative dispositions; ${unresolved.length} unresolved, ${outsideModel.length} outside model — ${unresolved.length || outsideModel.length ? 'partial scenario; unsupported effects are not zero effects' : 'bookkeeping complete, semantic completeness requires identified review'}` };
}

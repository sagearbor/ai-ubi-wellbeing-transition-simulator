/**
 * Locked-tier data for the AI Futures Map: the seed graph and curated interventions,
 * bundled from data/futures/ at build time. Validated by `npm run validate:futures`.
 */
import graphJson from '../../data/futures/graph.json';
import aiDividendFund from '../../data/futures/interventions/ai-dividend-fund.json';
import computeTreaty from '../../data/futures/interventions/compute-treaty.json';
import resilienceEnclaves from '../../data/futures/interventions/resilience-enclaves.json';
import frontierEvalsMandate from '../../data/futures/interventions/frontier-evals-mandate.json';
import type { FuturesGraph, Intervention } from './types';

export const LOCKED_GRAPH = graphJson as unknown as FuturesGraph;

export const LOCKED_INTERVENTIONS: Intervention[] = [
  aiDividendFund,
  computeTreaty,
  resilienceEnclaves,
  frontierEvalsMandate,
] as unknown as Intervention[];

const CUSTOM_KEY = 'futures.customInterventions.v1';

/** Interventions the visitor authored or extracted in this browser (per-viewer, localStorage). */
export function loadCustomInterventions(): Intervention[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Intervention[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomInterventions(list: Intervention[]): void {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: session-only */
  }
}

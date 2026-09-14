/**
 * Worked policy examples: a real public text, stored verbatim with its URL, and a draft read against
 * one bundled model. The Lab's Policy panel offers these as "Load worked example".
 */
import type { PolicyDraft } from './types';
import s3877Source from '../../data/policy/examples/s3877-itwa-2026.source.json';
import s3877Draft from '../../data/policy/examples/s3877-itwa-2026.draft.json';

export interface PolicyExampleSource {
  id: string;
  title: string;
  url: string;
  landingPage?: string;
  congressGov?: string;
  introduced?: string;
  retrieved: string;
  license: string;
  excerptNote: string;
  text: string;
}

export interface PolicyExample {
  id: string;
  label: string;
  modelId: string;
  source: PolicyExampleSource;
  draft: PolicyDraft;
}

export const POLICY_EXAMPLES: PolicyExample[] = [
  {
    id: 's3877-itwa-2026',
    label: "S. 3877, Investing in Tomorrow's Workforce Act of 2026 (training-funding model)",
    modelId: 'training-budget',
    source: s3877Source as PolicyExampleSource,
    draft: s3877Draft as unknown as PolicyDraft,
  },
];

export function findPolicyExample(id: string): PolicyExample | undefined {
  return POLICY_EXAMPLES.find((e) => e.id === id);
}

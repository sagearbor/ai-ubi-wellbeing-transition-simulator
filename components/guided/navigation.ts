import { recognizedShareHash } from '../lab/navigation';
/** Old destinations and validated hash owners always win over the welcome journey. */
export function initialGuidedMode(search:string,hash:string):'explore'|'compare'|null {
  if (recognizedShareHash(hash)) return null;
  const tab = new URLSearchParams(search).get('tab');
  return tab === 'compare' ? 'compare' : tab === null || tab === 'explore' ? 'explore' : null;
}

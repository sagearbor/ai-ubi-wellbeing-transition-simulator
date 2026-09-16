/** Hash owners validate their own content; this function only chooses the correct visible owner. */
export const appTabs = ['history', 'map', 'charts', 'corporations', 'futures', 'lab', 'analysis', 'overview', 'equations', 'guide', 'models', 'leaderboard', 'modelcard'] as const;
export type AppTab = typeof appTabs[number];
export function sharedRoute(search: string, hash: string): { tab: AppTab; edit: boolean; policy: boolean } {
  if (hash.startsWith('#lab=')) return {tab:'lab', edit:false, policy:true};
  if (hash.startsWith('#scenario=')) return {tab:'models', edit:true, policy:false};
  if (hash.startsWith('#futures=')) return {tab:'futures', edit:false, policy:false};
  if (hash.startsWith('#share=')) return {tab:'map', edit:false, policy:false};
  const tab = new URLSearchParams(search).get('tab');
  return {tab: appTabs.includes(tab as AppTab) ? tab as AppTab : 'map', edit:false, policy:false};
}
export function recognizedShareHash(hash: string): boolean { return ['#lab=', '#scenario=', '#futures=', '#share='].some(prefix => hash.startsWith(prefix)); }

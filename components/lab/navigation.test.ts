import { describe, it, expect } from 'vitest';
import { sharedRoute, recognizedShareHash } from './navigation';
describe('share route owner and precedence', () => {
  it.each([['#lab=bad','lab',false,true], ['#scenario=bad','models',true,false], ['#futures=bad','futures',false,false], ['#share=bad','map',false,false]] as const)('routes even invalid %s to its validator ahead of a query tab', (hash, tab, edit, policy) => {
    expect(sharedRoute('?tab=charts', hash)).toEqual({tab,edit,policy});
    expect(recognizedShareHash(hash)).toBe(true);
  });
  it('ordinary tab navigation and parser hash cleanup do not remount a draft', () => {
    expect(recognizedShareHash('')).toBe(false); expect(recognizedShareHash('#unrelated')).toBe(false);
    expect(sharedRoute('?tab=lab','')).toEqual({tab:'lab',edit:false,policy:false});
  });
});

import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import FuturesTab from './FuturesTab';
import { LOCKED_GRAPH, LOCKED_INTERVENTIONS } from '../../src/futures/data';
import { encodeFuturesState } from '../../src/futures/share';
const render=(hash:string)=>renderToString(<FuturesTab graph={LOCKED_GRAPH} interventions={LOCKED_INTERVENTIONS} initialHash={hash}/>);
describe('Futures share owner mounting',()=>{
 it('hydrates the shared sliders, interventions and calendar in real controls',()=>{
  const html=render('#futures='+encodeFuturesState({sliders:{[LOCKED_GRAPH.nodes[0].id]:1.25},interventions:[LOCKED_INTERVENTIONS[0].id],year:2035}));
  expect(html).not.toContain('Cannot open');expect(html).toContain('value="1.25"');expect(html).toContain('value="2035"');
  expect(html).toMatch(/aria-pressed="true"/);
 });
 it.each(['#futures=','#futures=bad','#futures='+encodeFuturesState({sliders:{'missing-node':1},interventions:[]}), '#futures='+encodeFuturesState({sliders:{},interventions:['missing-policy']}), '#futures='+encodeFuturesState({sliders:{},interventions:[],year:9999})])('refuses invalid or unavailable identities: %s',hash=>{const html=render(hash);expect(html).toContain('Cannot open this Futures scenario');expect(html).toContain('shared calculation was not opened');expect(html).not.toContain('GoodnessRiver');expect(html).not.toContain('type="range"');});
});

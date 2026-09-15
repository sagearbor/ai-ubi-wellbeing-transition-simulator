/** Invoke the real owner and its rendered input handlers. Minimal hook host avoids a DOM dependency;
 * effects, state, refs, rerenders and unmount cleanup are controlled, not production callbacks mocked. */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const host = vi.hoisted(() => ({ cells: [] as any[], cursor: 0, effects: [] as Array<() => void>, cleanups: [] as Array<() => void> }));
vi.mock('react', async original => {
  const react = await original<typeof import('react')>();
  return {...react,
    useState: (initial: any) => { const i=host.cursor++; if (!(i in host.cells)) host.cells[i]=typeof initial==='function'?initial():initial; return [host.cells[i], (value: any) => { host.cells[i]=typeof value==='function'?value(host.cells[i]):value; }]; },
    useRef: (initial: any) => { const i=host.cursor++; return host.cells[i] ??= {current:initial}; },
    useMemo: (fn: any) => fn(),
    useEffect: (fn: any, deps: any[]) => { const i=host.cursor++; const previous=host.cells[i]; if (!previous || deps.some((v,j)=>v!==previous[j])) { host.cells[i]=deps; host.effects.push(() => {const cleanup=fn();if(cleanup)host.cleanups.push(cleanup);}); } },
  };
});
import PolicyPanel, { type PolicyPanelProps } from './PolicyPanel';
import { findFixture } from '../../src/core/fixtures';
import { findPolicyExample } from '../../src/policy/examples';
import { createSyncRunner } from '../../src/workers/client';
import { buildBundle } from '../../src/policy/bundle';
const model=findFixture('training-budget')!.model;
const example=findPolicyExample('s3877-itwa-2026')!;
function nodes(tree: any): any[] { if (!tree || typeof tree!=='object') return []; if(Array.isArray(tree))return tree.flatMap(nodes);return [tree,...nodes(tree.props?.children)]; }
function words(tree: any): string { if(typeof tree==='string')return tree;if(Array.isArray(tree))return tree.map(words).join('');return tree&&typeof tree==='object'?words(tree.props?.children):''; }
function deferred<T>() { let resolve!: (v:T)=>void; const promise=new Promise<T>(r=>resolve=r);return {promise,resolve}; }
const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
function mount(extra: Partial<PolicyPanelProps>={}) {
 const runner=createSyncRunner(); const open=vi.fn();
 const props:PolicyPanelProps={model,overlays:[],runner,onOpenScenario:open,onRequestModel:vi.fn(),...extra};
 let tree:any;
 const render=()=>{host.cursor=0;tree=PolicyPanel(props);host.effects.splice(0).forEach(fn=>fn());};render();
 return {runner,open,render,get tree(){return tree;},file:(text:()=>Promise<string>)=>{const input=nodes(tree).find(n=>n.type==='input'&&n.props.type==='file');input.props.onChange({target:{files:[{size:100,text}],value:'selected'}});},unmount:()=>host.cleanups.splice(0).forEach(fn=>fn())};
}
function bundleText() { const runner=createSyncRunner();const outcome=runner.runSync({kind:'paired',model,overlays:[],drafts:[example.draft],runs:2,seed:1,sourceText:example.source.text});if(outcome.status!=='done'||!outcome.result[0])throw Error('fixture failed');return JSON.stringify(buildBundle(model,[],example.draft,outcome.result[0],{sourceText:example.source.text})); }
beforeEach(()=>{host.cells=[];host.cursor=0;host.effects=[];host.cleanups=[];});
describe('PolicyPanel real file input ownership',()=>{
 it('a delayed file cannot supersede the newer selected file',async()=>{const ui=mount();const a=deferred<string>();const b=deferred<string>();const text=bundleText();ui.file(()=>a.promise);ui.file(()=>b.promise);b.resolve(text);await flush();ui.render();expect(ui.open).toHaveBeenCalledOnce();a.resolve(text);await flush();expect(ui.open).toHaveBeenCalledOnce();});
 it('a delayed file cannot replace a newer manual draft',async()=>{const ui=mount();const a=deferred<string>();ui.file(()=>a.promise);const button=nodes(ui.tree).find(n=>n.type==='button'&&words(n).includes('Start a manual draft'));expect(button).toBeTruthy();button.props.onClick();ui.render();a.resolve(bundleText());await flush();expect(ui.open).not.toHaveBeenCalled();});
 it('does not start bundle validation after unmount while File.text is pending',async()=>{const ui=mount();const spy=vi.spyOn(ui.runner,'runSync');const a=deferred<string>();ui.file(()=>a.promise);ui.unmount();a.resolve(bundleText());await flush();expect(spy).not.toHaveBeenCalled();expect(ui.open).not.toHaveBeenCalled();});
 it('surfaces an owned rejected runner promise',async()=>{const runner={...createSyncRunner(),mode:'worker' as const,run:vi.fn(()=>({id:1,lane:'bundle',cancel:vi.fn(),promise:Promise.reject(new Error('reopen exploded'))}))} as any;const ui=mount({runner});ui.file(async()=>bundleText());await flush();ui.render();expect(words(ui.tree)).toContain('Cannot open this bundle: reopen exploded');expect(ui.open).not.toHaveBeenCalled();});
 it('does not apply a worker result after unmount',async()=>{const pending=deferred<any>();const cancel=vi.fn();const runner={...createSyncRunner(),mode:'worker' as const,run:vi.fn(()=>({id:1,lane:'bundle',cancel,promise:pending.promise}))} as any;const ui=mount({runner});ui.file(async()=>bundleText());await flush();expect(runner.run).toHaveBeenCalledOnce();ui.unmount();expect(cancel).toHaveBeenCalledOnce();pending.resolve({status:'done',result:{status:'reproduced',model,draft:example.draft,overlays:[]}});await flush();expect(ui.open).not.toHaveBeenCalled();});
 it('ignores a file selected before a source edit',async()=>{const ui=mount();const a=deferred<string>();ui.file(()=>a.promise);const input=nodes(ui.tree).find(n=>n.props?.id==='policy-source-text');input.props.onChange({target:{value:'New source'}});ui.render();a.resolve(bundleText());await flush();expect(ui.open).not.toHaveBeenCalled();});
 it('shows operative coverage in the owner and published alternate view',()=>{const publish=vi.fn();const ui=mount({initialDrafts:[example.draft],initialSource:example.source,onActiveRunChange:publish});expect(words(ui.tree)).toContain('68 unresolved');expect(publish.mock.calls.at(-1)?.[0].coverage).toContain('68 unresolved');expect(publish.mock.calls.at(-1)?.[0].coverage).toContain('Quotation coverage');});
});

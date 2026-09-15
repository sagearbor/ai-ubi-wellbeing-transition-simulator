/** Stateful host for the real App, using its rendered handlers and real simulation code.
 * No DOM package is present in this repository. This follows PolicyPanel.lifecycle.test.tsx:
 * hooks/effects/rerenders are hosted here, while production transitions are never mocked.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const host = vi.hoisted(() => ({ cells: [] as any[], cursor: 0, effects: [] as Array<() => void>, dirty: false }));
vi.mock('react', async original => {
  const react = await original<typeof import('react')>();
  const changed = (a: any[] | undefined, b: any[] | undefined) => !a || !b || a.length !== b.length || a.some((v,i) => !Object.is(v,b[i]));
  const memo = (fn: () => any, deps?: any[]) => {
    const i = host.cursor++;
    if (!host.cells[i] || changed(host.cells[i].deps, deps)) host.cells[i] = { deps, value: fn() };
    return host.cells[i].value;
  };
  const hooks = {
    useState(initial: any) {
      const i = host.cursor++;
      if (!(i in host.cells)) {
        host.cells[i] = { value: typeof initial === 'function' ? initial() : initial };
        host.cells[i].set = (next: any) => {
          const value = typeof next === 'function' ? next(host.cells[i].value) : next;
          if (!Object.is(value,host.cells[i].value)) {host.cells[i].value = value;host.dirty = true;}
        };
      }
      return [host.cells[i].value,host.cells[i].set];
    },
    useRef(initial: any) { const i=host.cursor++; return host.cells[i] ??= {current:initial}; },
    useMemo: memo,
    useCallback: (fn: any, deps?: any[]) => memo(() => fn,deps),
    useEffect(fn: () => any, deps?: any[]) {
      const i=host.cursor++;
      if (!host.cells[i] || changed(host.cells[i].deps,deps)) {
        const previous=host.cells[i];
        host.cells[i]={deps};
        host.effects.push(() => {previous?.cleanup?.();host.cells[i].cleanup=fn();});
      }
    },
  };
  return {...react,...hooks,default:{...react.default,...hooks}};
});
import App from '../../App';
import { buildExperiment, decodeExperiment, encodeExperiment, exactModel, FINANCE_PREFIX } from '../../src/financials/share';
import { modelHash } from '../../src/policy/hash';
import GuidedExperience from './GuidedExperience';
import LabTab from '../lab/LabTab';
import PublishedExperience from '../published/PublishedExperience';
import ScenarioContext from './ScenarioContext';
import ExploreIntro from './ExploreIntro';
import WorldMap from '../WorldMap';
import SimulationControls from '../SimulationControls';
import { ModelEditor } from '../ModelEditor';
import { ModelUpload } from '../ModelUpload';
import { DEFAULT_MODEL, DEFAULT_MODEL_CONFIG, PRESET_MODELS } from '../../constants';

function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree,...nodes(tree.props?.children)];
}
function words(tree: any): string {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (Array.isArray(tree)) return tree.map(words).join('');
  return tree && typeof tree === 'object' ? words(tree.props?.children) : '';
}
function mount(component = () => App({})) {
  let tree: any;
  const render = () => {
    for (let n=0;n<20;n++) {
      host.dirty=false;host.cursor=0;tree=component();host.effects.splice(0).forEach(fn=>fn());
      if (!host.dirty) return;
    }
    throw new Error('App did not settle');
  };
  render();
  return {
    render,
    get tree() {return tree;},
    component(type: any) {const node=nodes(tree).find(n=>n.type===type);expect(node,`component ${type.name}`).toBeTruthy();return node;},
    click(name: string) {const button=nodes(tree).find(n=>n.type==='button'&&(words(n)===name||n.props['aria-label']===name));expect(button,`button ${name}`).toBeTruthy();button.props.onClick();render();},
    action(fn: () => void) {fn();render();},
  };
}
beforeEach(() => {
  host.cells=[];host.cursor=0;host.effects=[];host.dirty=false;
  vi.useFakeTimers();
  const local = new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(k:string)=>local.get(k)??null,setItem:(k:string,v:string)=>local.set(k,v),removeItem:(k:string)=>local.delete(k)});
  const document={title:'test',activeElement:null,documentElement:{classList:{add:vi.fn(),remove:vi.fn()}},getElementById:()=>null};
  vi.stubGlobal('document',document);
  vi.stubGlobal('window',{document,location:{search:'',hash:'',pathname:'/',origin:'http://test',href:'http://test/'},history:{pushState:vi.fn()},addEventListener:vi.fn(),removeEventListener:vi.fn(),innerWidth:1440});
  vi.stubGlobal('requestAnimationFrame',(fn:()=>void)=>{fn();return 1;});
});
afterEach(() => {host.cells.forEach(c=>c?.cleanup?.());vi.useRealTimers();vi.unstubAllGlobals();});
function worldHome(ui: ReturnType<typeof mount>) { ui.click('Transition Engine home'); ui.action(() => nodes(ui.tree).find(n => n.props?.onWorld && n.props?.onHistory).props.onWorld()); }
function mountWorld() { const ui = mount(); worldHome(ui); return ui; }
const legacy=PRESET_MODELS.find(m=>m.name.startsWith('Organic Incentive'))!;
function selectModel(ui: ReturnType<typeof mount>,name: string) {
  ui.action(()=>ui.component(GuidedExperience).props.onView('map'));
  ui.click(name);
  worldHome(ui);
}
function context(ui: ReturnType<typeof mount>) {
  const p=ui.component(GuidedExperience).props;
  return words(ScenarioContext({model:p.model,state:p.run.state,qualification:p.qualification,uploadedModelName:p.uploadedModelName,equationIssue:p.equationIssue}));
}

describe('real App navigation transitions',()=>{
  it('enter -> exit comparison restores one map and preserves the actual scenario',()=>{
    const ui=mountWorld();const original=ui.component(GuidedExperience).props.run;
    ui.action(()=>ui.component(GuidedExperience).props.onMapCompare());
    expect(nodes(ui.tree).filter(n=>n.type===WorldMap)).toHaveLength(2);
    ui.click('Exit map comparison');
    expect(nodes(ui.tree).filter(n=>n.type===WorldMap)).toHaveLength(1);
    worldHome(ui);
    expect(ui.component(GuidedExperience).props.run).toBe(original);
    ui.action(()=>ui.component(GuidedExperience).props.onMapCompare());
    worldHome(ui);
    ui.action(()=>ui.component(GuidedExperience).props.onView('map'));
    expect(nodes(ui.tree).filter(n=>n.type===WorldMap)).toHaveLength(1);
  });
  it('exit removes comparison-only equation restrictions and the main legacy run can step',()=>{
    const ui=mountWorld();selectModel(ui,legacy.name);
    ui.action(()=>ui.component(GuidedExperience).props.onMapCompare());
    worldHome(ui);
    ui.action(()=>ui.component(GuidedExperience).props.onView('models'));
    ui.click('Create/Edit Model');
    ui.action(()=>ui.component(ModelEditor).props.onRun(DEFAULT_MODEL_CONFIG));
    expect(ui.component(SimulationControls).props.disabled).toBe(true);
    ui.click('Exit map comparison');
    expect(ui.component(SimulationControls).props.disabled).toBe(false);
    ui.action(()=>ui.component(SimulationControls).props.onStep());
    expect(ui.component(SimulationControls).props.month).toBe(1);
  });
  it.each([legacy.name,PRESET_MODELS.find(m=>m.id==='evidence-anchored')!.name])('home preserves %s; explicit reference action initializes a working paired dividend',name=>{
    const ui=mountWorld();selectModel(ui,name);
    const before=ui.component(GuidedExperience).props;
    expect(before.model.name).toBe(name);
    expect(before.needsDividendReference).toBe(true);
    expect(context(ui)).not.toContain('monthly-flow snapshot');
    expect(context(ui)).not.toContain('conditional wellbeing index');
    expect(words(ExploreIntro({onDividend:before.onDividend,onPolicy:()=>{},onTraining:()=>{},onBuild:()=>{},onRisk:()=>{},startsReference:true}))).toContain('new month-zero scenario');
    ui.action(()=>before.onDividend());
    const after=ui.component(GuidedExperience).props;
    expect(after.model.id).toBe(DEFAULT_MODEL.id);
    expect(after.run.state.sourceAccounting.actual).toBeGreaterThan(0);
    expect(after.paired.state.sourceAccounting.actual).toBe(0);
    expect(after.run.state.month).toBe(0);
    expect(after.needsDividendReference).toBe(false);
  });
  it('refuses incompatible comparison entry without crashing or changing the current run',()=>{
    const ui=mountWorld();selectModel(ui,legacy.name);
    ui.action(()=>ui.component(GuidedExperience).props.onView('models'));
    ui.action(()=>ui.component(ModelUpload).props.onApply(DEFAULT_MODEL_CONFIG));
    worldHome(ui);
    const before=ui.component(GuidedExperience).props.run;
    ui.action(()=>ui.component(GuidedExperience).props.onMapCompare());
    expect(ui.component(GuidedExperience).props.error).toContain('Map comparison unavailable');
    expect(ui.component(GuidedExperience).props.run).toBe(before);
  });
  it('clears incompatible uploaded hooks when explicitly starting the reference',()=>{
    const ui=mountWorld();ui.action(()=>ui.component(GuidedExperience).props.onView('models'));
    ui.action(()=>ui.component(ModelUpload).props.onApply({...DEFAULT_MODEL_CONFIG,name:'Uploaded hook probe'}));
    worldHome(ui);
    expect(context(ui)).toContain('unsupported calculation');
    expect(context(ui)).not.toContain('Accounting reviewed');
    ui.action(()=>ui.component(GuidedExperience).props.onDividend());
    const p=ui.component(GuidedExperience).props;
    expect(p.uploadedModelName).toBeUndefined();expect(p.equationIssue).toBeUndefined();
    expect(p.needsDividendReference).toBe(false);
    ui.action(()=>p.onView('map'));
    expect(ui.component(SimulationControls).props.disabled).toBe(false);
    ui.action(()=>ui.component(SimulationControls).props.onStep());
    expect(ui.component(SimulationControls).props.month).toBe(1);
  });
  it('exploring an already valid conditional dividend retains edited inputs and paired result',()=>{
    const ui=mountWorld();let p=ui.component(GuidedExperience).props;
    ui.action(()=>p.onUpdate(p.run.corporations[0].id,{availableShare:.25,fundingRequest:{kind:'amount',monthlyBillions:40},distributionStrategy:'hq-local'}));
    p=ui.component(GuidedExperience).props;const before=p.run,paired=p.paired;
    ui.action(()=>p.onDividend());p=ui.component(GuidedExperience).props;
    expect(p.run).toBe(before);expect(p.paired).toBe(paired);
    expect(context(ui)).toContain('accounting not rechecked');
    expect(context(ui)).toContain('conditional wellbeing index');
  });
  it('US reference context states its own horizon without conditional labeling',()=>{
    const ui=mountWorld();selectModel(ui,PRESET_MODELS.find(m=>m.id==='us-reference-korinek')!.name);
    expect(context(ui)).toContain('January 2030');
    expect(context(ui)).not.toContain('conditional wellbeing index');
    expect(context(ui)).not.toContain('Accounting reviewed');
  });
});

describe('published front door and route ownership',()=>{
  it('opens published Explore by default without mounting a world map and retains Lab',()=>{
    const ui=mount();expect(nodes(ui.tree).filter(n=>n.type===WorldMap)).toHaveLength(0);
    const published=()=>nodes(ui.tree).find(n=>n.props?.onWorld&&n.props?.onHistory);
    expect(published().props.mode).toBe('explore');ui.click('Compare');expect(published().props.mode).toBe('compare');
    ui.click('Model Lab');const lab=nodes(ui.tree).find(n=>n.type===LabTab);expect(lab).toBeTruthy();
    ui.click('Explore');expect(nodes(ui.tree).find(n=>n.type===LabTab)?.type).toBe(lab.type);
    ui.click('History');expect(nodes(ui.tree).find(n=>n.type==='button'&&words(n)==='History').props['aria-current']).toBe('page');
    ui.click('Explore');expect(published().props.mode).toBe('explore');
  });
  it('keeps explicit history and legacy hash owners out of the new front door',()=>{
    window.location.search='?tab=history';let ui=mount();expect(nodes(ui.tree).find(n=>n.type==='button'&&words(n)==='History').props['aria-current']).toBe('page');
  });
  it('surfaces malformed financial hashes without calculating defaults',()=>{
    window.location.hash='#finance=%broken';const ui=mount();const published=nodes(ui.tree).find(n=>n.props?.onWorld&&n.props?.onHistory);expect(published.props.error).toBeTruthy();expect(published.props.initial).toBeUndefined();expect(nodes(ui.tree).filter(n=>n.type===WorldMap)).toHaveLength(0);
  });
});

it('opens the validated exact financial B model with its app origin in a fresh Lab',()=>{
 const experiment=buildExperiment();window.location.search='?tab=lab&side=B';window.location.hash=FINANCE_PREFIX+encodeExperiment(experiment);
 const ui=mount();const lab=ui.component(LabTab);
 expect(lab.props.initialFinancialExperiment.side).toBe('B');
 expect(modelHash(exactModel(lab.props.initialFinancialExperiment.experiment,'B'))).toBe(experiment.modelHashes.B);
 expect(lab.props.entryRequest).toBeUndefined();
 expect(nodes(ui.tree).filter(n=>n.type===WorldMap)).toHaveLength(0);
});

it('an edited published A action reaches the real App with exact financial pins and policy entry',()=>{
 const published=mount(()=>PublishedExperience({mode:'compare',onMode:()=>{},onLab:()=>{},onWorld:()=>{},onHistory:()=>{},onRisk:()=>{}}));
 published.action(()=>nodes(published.tree).find(n=>n.props?.id==='pub-company').props.onChange({target:{value:'nvidia-fy2025'}}));
 published.action(()=>nodes(published.tree).find(n=>n.props?.side==='A').props.update({policyShare:.37,trainingShare:.12}));
 const link=nodes(published.tree).find(n=>n.type==='a'&&words(n)==='Paste a policy');
 expect(link).toBeTruthy();expect(link.props.target).toBe('_blank');
 const url=new URL(link.props.href);const saved=decodeExperiment(url.hash);
 expect(saved.recordId).toBe('nvidia-fy2025');expect(saved.scenarios.A.policyShare).toBe(.37);
 host.cells=[];host.cursor=0;host.effects=[];host.dirty=false;
 window.location.search=url.search;window.location.hash=url.hash;
 const app=mount();const lab=app.component(LabTab);
 expect(lab.props.initialFinancialExperiment.experiment).toEqual(saved);
 expect(lab.props.initialFinancialExperiment.side).toBe('A');
 expect(lab.props.entryRequest).toEqual({kind:'policy',sequence:1});
 expect(modelHash(exactModel(lab.props.initialFinancialExperiment.experiment,'A'))).toBe(saved.modelHashes.A);
 const initial=lab.props.initialFinancialExperiment;
 app.click('Explore');app.click('Model Lab');
 expect(app.component(LabTab).props.initialFinancialExperiment).toBe(initial);
 expect(app.component(LabTab).key).toBe(lab.key);
});

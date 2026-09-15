import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import ModelEditor from './ModelEditor';
afterEach(()=>vi.unstubAllGlobals());
it('the equation owner visibly refuses an empty recognized scenario payload',()=>{
 vi.stubGlobal('window',{location:{hash:'#scenario=',pathname:'/',search:''}});
 const html=renderToString(<ModelEditor initialConfig={null} onSave={()=>{}} onRun={()=>{}} onCancel={()=>{}} onRunTests={()=>{}}/>);
 expect(html).toContain('Cannot open this equation scenario: empty share payload.');
});

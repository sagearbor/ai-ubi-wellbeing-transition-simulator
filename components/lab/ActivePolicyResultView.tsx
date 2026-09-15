import React, { useState } from 'react';
import type { ActiveRunView } from './activeRunView';
import { calendarNote, timeAxisTitle } from '../../src/core/calendar';
import PolicyResults from './PolicyResults';
export default function ActivePolicyResultView({ view, onAuthor, onWorld }: { view: ActiveRunView | null; onAuthor: () => void; onWorld: () => void }) {
  const [year, setYear] = useState<number | null>(null);
  return <div className="space-y-4 pb-24" data-testid="active-policy-result">
    <h2 className="text-lg font-bold">Policy comparison · {view?.model.name ?? 'No policy selected'}</h2>
    <p>Model Lab · {view?.model.id} · schema {view?.model.schemaVersion} · draft {view?.slot === 1 ? 'B' : 'A'} · {view?.status ?? 'empty'}</p>
    <p className="break-all text-xs">Result identity: {view?.key}</p><p>Scenario origin: {view?.origin}</p><p>Scope: {view?.scope}</p><p>Source: {view?.source?.title ?? 'No pinned source'} · {view?.review}</p>
    <p>Calendar: {timeAxisTitle(view?.model.time)} · {view?.model.time.start}–{view?.model.time.end}. {calendarNote(view?.model.time)}</p><p>{view?.coverage}</p>
    {view?.limitations.map((text) => <p key={text} className="text-sm text-amber-700 dark:text-amber-300">{text}</p>)}
    <div className="flex flex-wrap gap-4"><button className="underline min-h-11" onClick={onAuthor}>Return to draft, share link or download bundle</button><button className="underline min-h-11" onClick={onWorld}>Switch to world model</button></div>
    {view?.status === 'ready' ? <PolicyResults model={view.model} modelStatus={view.modelStatus} entries={view.entries} active={view.entries.findIndex(e => e.slot === view.slot)} year={year} onYear={setYear} /> : <p role="status">No current successful calculation is displayed. Return to the draft and run the comparison.</p>}
  </div>;
}

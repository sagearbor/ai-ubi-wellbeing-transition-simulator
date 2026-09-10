/**
 * InterventionImportPanel — "paste a bill" (design doc section 6).
 *
 * Paste text or fetch a URL, send it to Gemini via services/futuresExtract.ts, and land on an
 * editable review card: label, summary, source, cost band, start year, and one row per nudge
 * (node / direction / magnitude / lag / evidence quote). Nothing is trusted until a human hits
 * Apply - every card that reaches this panel is tier 'public', status 'ai-drafted' until then.
 *
 * No API key configured? "Start from blank card" opens the same form for manual authoring, so
 * the feature degrades to "author an intervention" instead of disappearing.
 */

import React, { useMemo, useState } from 'react';
import {
  extractIntervention,
  fetchSourceText,
  NoApiKeyError,
  RateLimitError,
  SourceFetchError,
} from '../../services/futuresExtract';
import { CostBand, Direction, FuturesGraph, Intervention, Magnitude, Nudge } from '../../src/futures/types';

interface InterventionImportPanelProps {
  graph: FuturesGraph;
  onAdd: (iv: Intervention) => void;
}

const MAGNITUDES: Magnitude[] = ['slight', 'moderate', 'strong'];
const DIRECTIONS: Direction[] = ['up', 'down'];
const COST_BANDS: CostBand[] = [1, 2, 3, 4, 5];

function blankIntervention(graph: FuturesGraph): Intervention {
  return {
    schemaVersion: 1,
    id: `intervention-${Date.now()}`,
    label: '',
    summary: '',
    source: { kind: 'editorial' },
    tier: 'public',
    status: 'ai-drafted',
    cost: { band: 3 },
    startYear: graph.startYear,
    nudges: [],
  };
}

function blankNudge(nodeId: string): Nudge {
  return { node: nodeId, direction: 'up', magnitude: 'moderate' };
}

const inputCls =
  'w-full min-h-11 px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm ' +
  'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 ' +
  'dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500';

const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1';

const buttonBase =
  'min-h-11 px-4 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const primaryButton = `${buttonBase} bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400`;
const secondaryButton =
  `${buttonBase} bg-gray-100 text-gray-800 hover:bg-gray-200 ` +
  `dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600`;
const dangerButton = `${buttonBase} bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900`;

export const InterventionImportPanel: React.FC<InterventionImportPanelProps> = ({ graph, onAdd }) => {
  const [pastedText, setPastedText] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<'idle' | 'fetching' | 'extracting'>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<'info' | 'error' | 'success'>('info');
  const [draftErrors, setDraftErrors] = useState<string[]>([]);
  const [draft, setDraft] = useState<Intervention | null>(null);

  const eventNodes = useMemo(
    () => graph.nodes.filter((n) => n.kind === 'event' && !n.retired),
    [graph]
  );

  const setStatus = (message: string, kind: 'info' | 'error' | 'success' = 'info') => {
    setStatusMessage(message);
    setStatusKind(kind);
  };

  const handleFetch = async () => {
    if (!url.trim()) {
      setStatus('Enter a URL to fetch first.', 'error');
      return;
    }
    setBusy('fetching');
    setStatus(`Fetching ${url}...`);
    try {
      const text = await fetchSourceText(url.trim());
      setPastedText(text);
      setStatus(`Fetched ${text.length.toLocaleString()} characters. Review the text below, then Extract.`, 'success');
    } catch (err) {
      if (err instanceof SourceFetchError) {
        setStatus(err.message, 'error');
      } else {
        setStatus(err instanceof Error ? err.message : 'Fetch failed. Paste the text instead.', 'error');
      }
    } finally {
      setBusy('idle');
    }
  };

  const handleExtract = async () => {
    if (!pastedText.trim()) {
      setStatus('Paste some text (or fetch a URL) first.', 'error');
      return;
    }
    setBusy('extracting');
    setDraftErrors([]);
    setStatus('Asking Gemini to extract an intervention card...');
    try {
      const sourceMeta = { url: url.trim() || undefined, title: undefined as string | undefined };
      const { intervention, errors } = await extractIntervention(graph, pastedText, sourceMeta);
      if (intervention) {
        setDraft(intervention);
        setStatus(
          errors.length > 0
            ? `Extracted with ${errors.length} warning(s) - review carefully below.`
            : 'Extracted. Review and edit the card below, then Apply.',
          errors.length > 0 ? 'error' : 'success'
        );
        setDraftErrors(errors);
      } else {
        setDraftErrors(errors);
        setStatus('Extraction did not produce a usable card - see the errors below, or start from blank.', 'error');
      }
    } catch (err) {
      if (err instanceof NoApiKeyError) {
        setStatus('No Gemini API key configured. Use "Start from blank card" to author one by hand instead.', 'error');
      } else if (err instanceof RateLimitError) {
        setStatus(err.message, 'error');
      } else {
        setStatus(err instanceof Error ? err.message : 'Extraction failed.', 'error');
      }
    } finally {
      setBusy('idle');
    }
  };

  const handleBlankCard = () => {
    setDraft(blankIntervention(graph));
    setDraftErrors([]);
    setStatus('Blank card ready - fill it in by hand, then Apply.', 'info');
  };

  const updateDraft = <K extends keyof Intervention>(key: K, value: Intervention[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateNudge = (index: number, patch: Partial<Nudge>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nudges = prev.nudges.map((n, i) => (i === index ? { ...n, ...patch } : n));
      return { ...prev, nudges };
    });
  };

  const removeNudge = (index: number) => {
    setDraft((prev) => (prev ? { ...prev, nudges: prev.nudges.filter((_, i) => i !== index) } : prev));
  };

  const addNudge = () => {
    if (eventNodes.length === 0) return;
    setDraft((prev) => (prev ? { ...prev, nudges: [...prev.nudges, blankNudge(eventNodes[0].id)] } : prev));
  };

  const handleApply = () => {
    if (!draft) return;
    onAdd(draft);
    setDraft(null);
    setDraftErrors([]);
    setStatus('Applied to the graph.', 'success');
  };

  const statusColor =
    statusKind === 'error'
      ? 'text-red-600 dark:text-red-400'
      : statusKind === 'success'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-gray-600 dark:text-gray-400';

  return (
    <div className="w-full max-w-2xl mx-auto rounded-lg border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-700 dark:bg-gray-900">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Paste a bill</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Paste policy text, or fetch a URL, then extract an intervention card. Every AI-drafted nudge must carry a
        verbatim evidence quote - review and edit before applying it to the graph.
      </p>

      <div className="space-y-3">
        <div>
          <label className={labelCls} htmlFor="futures-import-url">
            Source URL (optional)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="futures-import-url"
              type="text"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
            <button
              type="button"
              onClick={handleFetch}
              disabled={busy !== 'idle'}
              className={`${secondaryButton} whitespace-nowrap`}
            >
              {busy === 'fetching' ? 'Fetching...' : 'Fetch'}
            </button>
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="futures-import-text">
            Bill / proposal text
          </label>
          <textarea
            id="futures-import-text"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={8}
            placeholder="Paste the text of a bill, proposal, or paper here..."
            className={`${inputCls} font-mono`}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExtract}
            disabled={busy !== 'idle'}
            className={primaryButton}
          >
            {busy === 'extracting' ? 'Extracting...' : 'Extract'}
          </button>
          <button type="button" onClick={handleBlankCard} disabled={busy !== 'idle'} className={secondaryButton}>
            Start from blank card
          </button>
        </div>

        {statusMessage && (
          <p className={`text-sm ${statusColor}`} role="status">
            {statusMessage}
          </p>
        )}

        {draftErrors.length > 0 && (
          <ul className="text-xs text-red-600 dark:text-red-400 list-disc pl-5 space-y-0.5">
            {draftErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </div>

      {draft && (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Review card</h3>
            {draft.status === 'ai-drafted' && (
              <span className="inline-flex items-center rounded-full bg-amber-200 px-2.5 py-1 text-xs font-medium text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                AI-drafted, unreviewed
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls} htmlFor="futures-draft-label">
                Label
              </label>
              <input
                id="futures-draft-label"
                type="text"
                value={draft.label}
                onChange={(e) => updateDraft('label', e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls} htmlFor="futures-draft-summary">
                Summary
              </label>
              <textarea
                id="futures-draft-summary"
                value={draft.summary}
                onChange={(e) => updateDraft('summary', e.target.value)}
                rows={2}
                className={inputCls}
              />
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400">
              Source: {draft.source.kind}
              {draft.source.title ? ` - ${draft.source.title}` : ''}
              {draft.source.url ? ` (${draft.source.url})` : ''}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="futures-draft-cost-band">
                  Cost band (1-5)
                </label>
                <select
                  id="futures-draft-cost-band"
                  value={draft.cost.band}
                  onChange={(e) => updateDraft('cost', { ...draft.cost, band: Number(e.target.value) as CostBand })}
                  className={inputCls}
                >
                  {COST_BANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="futures-draft-start-year">
                  Start year
                </label>
                <input
                  id="futures-draft-start-year"
                  type="number"
                  min={graph.startYear}
                  max={graph.endYear}
                  value={draft.startYear}
                  onChange={(e) => updateDraft('startYear', Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="futures-draft-cost-note">
                Cost note
              </label>
              <input
                id="futures-draft-cost-note"
                type="text"
                value={draft.cost.note ?? ''}
                onChange={(e) => updateDraft('cost', { ...draft.cost, note: e.target.value })}
                placeholder="One line explaining the cost band pick"
                className={inputCls}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Nudges ({draft.nudges.length})
                </span>
                <button
                  type="button"
                  onClick={addNudge}
                  disabled={eventNodes.length === 0}
                  className={`${secondaryButton} !min-h-9 !px-3 text-xs`}
                >
                  + Add nudge
                </button>
              </div>

              <div className="space-y-3">
                {draft.nudges.map((nudge, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-gray-200 p-3 dark:border-gray-700 bg-white dark:bg-gray-800"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div className="sm:col-span-2">
                        <label className={labelCls}>Node</label>
                        <select
                          value={nudge.node}
                          onChange={(e) => updateNudge(i, { node: e.target.value })}
                          className={inputCls}
                        >
                          {eventNodes.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Direction</label>
                        <select
                          value={nudge.direction}
                          onChange={(e) => updateNudge(i, { direction: e.target.value as Direction })}
                          className={inputCls}
                        >
                          {DIRECTIONS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Magnitude</label>
                        <select
                          value={nudge.magnitude}
                          onChange={(e) => updateNudge(i, { magnitude: e.target.value as Magnitude })}
                          className={inputCls}
                        >
                          {MAGNITUDES.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-2">
                      <div>
                        <label className={labelCls}>Lag (years)</label>
                        <input
                          type="number"
                          min={0}
                          value={nudge.lag ?? 0}
                          onChange={(e) => updateNudge(i, { lag: Number(e.target.value) })}
                          className={inputCls}
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className={labelCls}>Evidence quote (read-only)</label>
                        <textarea
                          readOnly
                          value={nudge.evidence ?? '(no evidence - manually added)'}
                          rows={2}
                          className={`${inputCls} bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-400`}
                        />
                      </div>
                    </div>

                    <div className="mt-2 flex justify-end">
                      <button type="button" onClick={() => removeNudge(i)} className={`${dangerButton} !min-h-9 !px-3 text-xs`}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                {draft.nudges.length === 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    No nudges yet. Add one, or apply a summary-only card.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={handleApply} className={primaryButton}>
              Apply
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setDraftErrors([]);
              }}
              className={secondaryButton}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterventionImportPanel;

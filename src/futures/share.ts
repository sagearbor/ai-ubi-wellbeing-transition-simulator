/**
 * AI Futures Map — "here is my version of the future" links.
 *
 * A what-if is three things: where the sliders are (per node, in log-odds), which intervention
 * cards are toggled on, and which year the scrubber sits at. All three serialise into the URL
 * hash exactly like `src/services/scenarioShare.ts` does for model scenarios, so sharing needs
 * no backend at all.
 *
 *   #futures=<base64url of {"s":{...},"i":[...],"y":2035}>
 *
 * Differences from scenarioShare.ts, both deliberate:
 *   - **base64url** (`-` `_`, no `=` padding) rather than plain base64, because these links get
 *     pasted into chat clients that mangle `+` and `/` inside a fragment.
 *   - **Never throws.** A scenario link failing loudly is right — the user chose a file. A
 *     futures link is something a stranger pasted, so garbage decodes to `null` and the app
 *     just shows the baseline.
 *
 * The UTF-8-safe base64 pattern is lifted from scenarioShare.ts (its helpers are module-private
 * there, so they are re-implemented here rather than exported and shared).
 */

/** Slider positions are stored to this many decimals; the extra precision is invisible. */
const SLIDER_DECIMALS = 2;
/** A slider cannot mean more than this many log-odds; guards a hand-edited hash. */
const SLIDER_LIMIT = 12;
const MAX_PAYLOAD_CHARS = 64_000;

export const FUTURES_HASH_PREFIX = '#futures=';

export interface FuturesShareState {
  /** nodeId -> constant log-odds shift applied to the whole curve (what a slider does). */
  sliders: Record<string, number>;
  /** Ids of the toggled-on intervention cards. */
  interventions: string[];
  /** Where the year scrubber sits. Omitted when the app is showing the whole span. */
  year?: number;
}

/** The compact on-the-wire shape. Short keys keep the pasted link short. */
interface WireState {
  s?: Record<string, number>;
  i?: string[];
  y?: number;
}

// ---------------------------------------------------------------------------
// base64url, UTF-8 safe
// ---------------------------------------------------------------------------

function utf8ToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

const round = (x: number): number => {
  const f = 10 ** SLIDER_DECIMALS;
  // + 0 normalises -0 to 0, so an untouched slider never shows up as "-0" in the link
  return Math.round(x * f) / f + 0;
};

/**
 * Encode a what-if into the base64url payload that goes after `#futures=`.
 *
 * Sliders are rounded to 2 decimals and any that round to zero are dropped — dragging a slider
 * and putting it back must not leave a trace in the link.
 */
export function encodeFuturesState(state: FuturesShareState): string {
  const sliders: Record<string, number> = {};
  for (const [id, raw] of Object.entries(state.sliders ?? {})) {
    if (!id || typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    const v = round(Math.max(-SLIDER_LIMIT, Math.min(SLIDER_LIMIT, raw)));
    if (v === 0) continue;
    sliders[id] = v;
  }

  const interventions = (state.interventions ?? []).filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );

  const wire: WireState = {};
  if (Object.keys(sliders).length > 0) wire.s = sliders;
  if (interventions.length > 0) wire.i = interventions;
  if (typeof state.year === 'number' && Number.isFinite(state.year)) wire.y = Math.round(state.year);

  return utf8ToBase64Url(JSON.stringify(wire));
}

/** Build a full, copyable share URL. */
export function buildFuturesShareUrl(state: FuturesShareState, origin: string, pathname: string): string {
  return `${origin}${pathname}${FUTURES_HASH_PREFIX}${encodeFuturesState(state)}`;
}

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

/**
 * Decode a payload produced by `encodeFuturesState`.
 *
 * Returns `null` for anything unusable — not base64, not JSON, not the right shape — and
 * silently drops individual fields that are the wrong type rather than failing the whole link.
 * Never throws.
 */
export function decodeFuturesState(encoded: string): FuturesShareState | null {
  if (typeof encoded !== 'string') return null;
  const payload = encoded.trim();
  if (!payload || payload.length > MAX_PAYLOAD_CHARS) return null;
  if (!/^[A-Za-z0-9\-_+/]+={0,2}$/.test(payload)) return null;

  let json: string;
  try {
    json = base64UrlToUtf8(payload);
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const wire = parsed as Record<string, unknown>;

  const sliders: Record<string, number> = {};
  const rawSliders = wire.s;
  if (rawSliders && typeof rawSliders === 'object' && !Array.isArray(rawSliders)) {
    for (const [id, v] of Object.entries(rawSliders as Record<string, unknown>)) {
      if (!id || typeof v !== 'number' || !Number.isFinite(v)) continue;
      const clamped = round(Math.max(-SLIDER_LIMIT, Math.min(SLIDER_LIMIT, v)));
      if (clamped === 0) continue;
      sliders[id] = clamped;
    }
  }

  const interventions: string[] = [];
  if (Array.isArray(wire.i)) {
    for (const id of wire.i) {
      if (typeof id === 'string' && id.length > 0 && !interventions.includes(id)) interventions.push(id);
    }
  }

  const out: FuturesShareState = { sliders, interventions };
  if (typeof wire.y === 'number' && Number.isFinite(wire.y)) out.year = Math.round(wire.y);
  return out;
}

/**
 * Pull the payload out of a `window.location.hash`-style string, or null when this hash is not
 * a futures link (empty, or one of the app's other `#scenario=` / `#share=` links).
 */
export function extractFuturesHashParam(hash: string): string | null {
  if (typeof hash !== 'string' || !hash) return null;
  const withHash = hash.startsWith('#') ? hash : `#${hash}`;
  if (!withHash.startsWith(FUTURES_HASH_PREFIX)) return null;
  // tolerate a trailing `&other=...` appended by a link shortener
  const value = withHash.slice(FUTURES_HASH_PREFIX.length).split('&')[0];
  return value.length > 0 ? value : null;
}

/** `location.hash` straight in, a what-if or null straight out. Never throws. */
export function parseFuturesHash(hash: string): FuturesShareState | null {
  const payload = extractFuturesHashParam(hash);
  return payload === null ? null : decodeFuturesState(payload);
}

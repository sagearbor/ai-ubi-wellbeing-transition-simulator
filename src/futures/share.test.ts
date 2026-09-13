/**
 * Tests for src/futures/share.ts — the `#futures=` what-if link.
 *
 * Two things matter: a link a user copies must come back identical, and a link a stranger
 * pasted must never throw.
 */

import { describe, expect, it } from 'vitest';
import {
  FUTURES_HASH_PREFIX,
  FuturesShareState,
  buildFuturesShareUrl,
  decodeFuturesState,
  encodeFuturesState,
  extractFuturesHashParam,
  parseFuturesHash,
} from './share';

const state: FuturesShareState = {
  sliders: { 'frontier-agi': 1.25, 'oligarchic-capture': -0.5, redistribution: 2 },
  interventions: ['dividend-fund', 'compute-treaty'],
  year: 2035,
};

describe('share: round trip', () => {
  it('comes back identical', () => {
    expect(decodeFuturesState(encodeFuturesState(state))).toEqual(state);
  });

  it('round-trips through a full URL', () => {
    const url = buildFuturesShareUrl(state, 'https://example.test', '/futures');
    expect(url.startsWith(`https://example.test/futures${FUTURES_HASH_PREFIX}`)).toBe(true);
    const hash = url.slice(url.indexOf('#'));
    expect(parseFuturesHash(hash)).toEqual(state);
  });

  it('round-trips the empty what-if', () => {
    const empty: FuturesShareState = { sliders: {}, interventions: [] };
    expect(decodeFuturesState(encodeFuturesState(empty))).toEqual(empty);
  });

  it('round-trips node ids with unicode and punctuation', () => {
    const odd: FuturesShareState = {
      sliders: { 'café-effondrement': -1.5, '人工知能': 0.75, 'a/b+c=d': 1 },
      interventions: ['🇪🇺-solidarity'],
    };
    expect(decodeFuturesState(encodeFuturesState(odd))).toEqual(odd);
  });

  it('produces a URL-safe payload (no +, / or = to be mangled in a fragment)', () => {
    const payload = encodeFuturesState({
      sliders: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`node-${i}`, (i % 7) - 3.5])),
      interventions: ['a', 'b', 'c'],
      year: 2045,
    });
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('omits the year when there is none', () => {
    const r = decodeFuturesState(encodeFuturesState({ sliders: { a: 1 }, interventions: [] }));
    expect(r).not.toBeNull();
    expect('year' in r!).toBe(false);
  });
});

describe('share: normalisation', () => {
  it('rounds slider values to 2 decimals', () => {
    const r = decodeFuturesState(encodeFuturesState({ sliders: { a: 1.23456789, b: -0.005 }, interventions: [] }));
    expect(r!.sliders.a).toBe(1.23);
    // Math.round rounds .5 toward +Infinity, so -0.005 becomes -0 and is dropped as "untouched"
    expect(r!.sliders).not.toHaveProperty('b');
  });

  it('rounds toward zero for tiny values and never emits -0', () => {
    const r = decodeFuturesState(encodeFuturesState({ sliders: { a: -0.004, b: 0.004 }, interventions: [] }));
    expect(r!.sliders).toEqual({}); // both round to zero and are dropped
    expect(Object.is(r!.sliders.a, -0)).toBe(false);
  });

  it('drops sliders sitting at zero, so dragging and undoing leaves no trace', () => {
    const r = decodeFuturesState(encodeFuturesState({ sliders: { a: 0, b: 1.5 }, interventions: [] }));
    expect(r!.sliders).toEqual({ b: 1.5 });
  });

  it('deduplicates intervention ids but keeps their order', () => {
    const r = decodeFuturesState(encodeFuturesState({ sliders: {}, interventions: ['b', 'a', 'b'] }));
    expect(r!.interventions).toEqual(['b', 'a']);
  });

  it('clamps an absurd hand-edited slider instead of trusting it', () => {
    const r = decodeFuturesState(encodeFuturesState({ sliders: { a: 1e9 }, interventions: [] }));
    expect(r!.sliders.a).toBeLessThanOrEqual(12);
    expect(r!.sliders.a).toBeGreaterThan(0);
  });

  it('rounds a fractional year', () => {
    expect(decodeFuturesState(encodeFuturesState({ sliders: {}, interventions: [], year: 2035.7 }))!.year).toBe(2036);
  });

  it('keeps the link short', () => {
    expect(encodeFuturesState(state).length).toBeLessThan(200);
  });
});

describe('share: garbage tolerance', () => {
  const garbage = [
    '',
    '   ',
    '!!!!',
    'not base64 at all',
    'YWJj', // valid base64, decodes to "abc", not JSON
    btoa('[1,2,3]').replace(/=+$/, ''), // valid JSON, but an array
    btoa('"just a string"').replace(/=+$/, ''),
    btoa('null').replace(/=+$/, ''),
    btoa('{').replace(/=+$/, ''),
    'x'.repeat(70_000),
  ];

  it('returns null and never throws', () => {
    for (const g of garbage) {
      expect(() => decodeFuturesState(g), g.slice(0, 20)).not.toThrow();
      expect(decodeFuturesState(g), g.slice(0, 20)).toBeNull();
    }
  });

  it('survives wrongly-typed fields by dropping them, not the whole link', () => {
    const payload = btoa(JSON.stringify({ s: { a: 'nope', b: 1.5, c: null }, i: ['ok', 7, null], y: 'soon' })).replace(/=+$/, '');
    const r = decodeFuturesState(payload);
    expect(r).toEqual({ sliders: { b: 1.5 }, interventions: ['ok'] });
  });

  it('survives entirely missing fields', () => {
    const r = decodeFuturesState(btoa('{}').replace(/=+$/, ''));
    expect(r).toEqual({ sliders: {}, interventions: [] });
  });

  it('survives a non-string argument', () => {
    expect(decodeFuturesState(undefined as unknown as string)).toBeNull();
    expect(decodeFuturesState(null as unknown as string)).toBeNull();
  });
});

describe('share: hash extraction', () => {
  it('accepts the hash with or without its leading #', () => {
    const payload = encodeFuturesState(state);
    expect(extractFuturesHashParam(`#futures=${payload}`)).toBe(payload);
    expect(extractFuturesHashParam(`futures=${payload}`)).toBe(payload);
  });

  it('ignores the app\'s other hash links', () => {
    expect(extractFuturesHashParam('#scenario=abc')).toBeNull();
    expect(extractFuturesHashParam('#share=abc')).toBeNull();
    expect(extractFuturesHashParam('#')).toBeNull();
    expect(extractFuturesHashParam('')).toBeNull();
    expect(extractFuturesHashParam('#futures=')).toBeNull();
    expect(parseFuturesHash('#scenario=abc')).toBeNull();
  });

  it('stops at an appended parameter', () => {
    const payload = encodeFuturesState(state);
    expect(extractFuturesHashParam(`#futures=${payload}&utm=x`)).toBe(payload);
    expect(parseFuturesHash(`#futures=${payload}&utm=x`)).toEqual(state);
  });

  it('accepts a plain-base64 payload too, in case something re-encoded the link', () => {
    const json = JSON.stringify({ s: { a: 1 }, i: [], y: 2030 });
    // force + and / into the payload by round-tripping through standard base64
    const plain = btoa(unescape(encodeURIComponent(json)));
    expect(decodeFuturesState(plain)).toEqual({ sliders: { a: 1 }, interventions: [], year: 2030 });
  });
});

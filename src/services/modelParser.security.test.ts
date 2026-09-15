import { describe, expect, it } from 'vitest';
import { parseModelContent } from './modelParser';

describe('patched YAML parser hostile-input limits', () => {
  it('rejects excessive collection nesting in explicit and inferred YAML', () => {
    const nested = 'a: ' + '['.repeat(110) + '0' + ']'.repeat(110);
    for (const format of ['yaml', 'unknown'] as const)
      expect(() => parseModelContent(nested, format)).toThrow(/maxDepth/);
  });
  it('caps total merge-key processing before repeated aliases cause excessive work', () => {
    const keys = Array.from({ length: 101 }, (_, i) => `  k${i}: ${i}`).join('\n');
    const merges = Array.from({ length: 101 }, (_, i) => `b${i}:\n  <<: *base`).join('\n');
    expect(() => parseModelContent(`base: &base\n${keys}\n${merges}`, 'yaml')).toThrow(/maxTotalMergeKeys/);
  });
  it('rejects executable YAML tags and duplicate keys while parsing normal models', () => {
    expect(() => parseModelContent('a: !!js/function function() {}', 'yaml')).toThrow();
    expect(() => parseModelContent('a: 1\na: 2', 'yaml')).toThrow(/duplicated/);
    expect(parseModelContent('id: example\nparameters:\n  a: 1', 'yaml')).toEqual({ id: 'example', parameters: { a: 1 } });
  });
});

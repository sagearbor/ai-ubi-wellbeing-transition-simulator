/**
 * Tests for the sandboxed equation parser (mathParser.ts).
 *
 * Covers validation limits, the variable/function allow-lists, compilation,
 * evaluation, and the security guards that keep user-supplied equations
 * from escaping the sandbox.
 */

import { describe, it, expect } from 'vitest';
import {
  validateEquation,
  parseEquation,
  compileEquation,
  evaluateEquation,
  analyzeEquation,
  getAllowedVariables,
  getAllowedFunctions
} from './mathParser';

describe('validateEquation', () => {
  it('accepts a simple equation over allowed variables', () => {
    expect(validateEquation('adoption * 0.5 + wellbeing')).toEqual({ valid: true });
  });

  it('rejects equations over the maximum length', () => {
    const result = validateEquation('a'.repeat(501));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/maximum length/);
  });

  it('rejects dangerous patterns before parsing', () => {
    const result = validateEquation('eval(adoption)');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/forbidden pattern/);
  });
});

describe('parseEquation', () => {
  it('parses constant arithmetic', () => {
    const result = parseEquation('2 + 2');
    expect(result.valid).toBe(true);
    expect(result.node).toBeDefined();
  });

  it('parses equations with allowed variables', () => {
    expect(parseEquation('adoption * contributionRate + 0.1').valid).toBe(true);
  });

  it('parses calls to allowed functions (sqrt, log, min, pow)', () => {
    expect(parseEquation('sqrt(wellbeing) + log(adoption + 1)').valid).toBe(true);
    expect(parseEquation('min(adoption, wellbeing) * pow(2, 3)').valid).toBe(true);
  });

  it('accepts the PI constant used by the default equations', () => {
    expect(parseEquation('sin(adoption * PI) * 0.3').valid).toBe(true);
  });

  it('rejects equations above the operation limit', () => {
    const result = parseEquation('adoption+wellbeing+gdp+gini+governance+month+fundSize+population+aiRevenue+adoption+wellbeing+gdp+gini');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too complex/);
  });

  it('rejects functions outside the allow-list', () => {
    const result = parseEquation('evilFunc(adoption)');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Function 'evilFunc' is not allowed/);
  });

  it('rejects variables outside the allow-list', () => {
    const result = parseEquation('hackerVar * 2');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Variable 'hackerVar' is not allowed/);
  });
});

describe('compileEquation / evaluateEquation', () => {
  it('compiles and evaluates with the variables it reports', () => {
    const compiled = compileEquation('adoption * contributionRate + wellbeing * 0.5');
    expect(compiled).not.toBeNull();
    expect(compiled!.variables.sort()).toEqual(['adoption', 'contributionRate', 'wellbeing']);
    expect(compiled!.complexity).toBe(3);
    expect(compiled!.evaluate({ adoption: 0.5, contributionRate: 0.3, wellbeing: 0.8 })).toBeCloseTo(0.55, 10);
  });

  it('evaluates allowed functions in one shot', () => {
    expect(evaluateEquation('sqrt(25) + pow(2, 3)', {})).toBe(13);
    expect(evaluateEquation('min(adoption, wellbeing) * 100', { adoption: 0.7, wellbeing: 0.6 })).toBeCloseTo(60, 10);
  });

  it('returns null for equations that fail to compile', () => {
    expect(compileEquation('evilFunc(adoption)')).toBeNull();
    expect(evaluateEquation('hackerVar * 2', {})).toBeNull();
  });
});

describe('analyzeEquation', () => {
  it('reports variables and complexity for a valid equation', () => {
    const analysis = analyzeEquation('adoption * (1 - displacementRate) + ubiReceived / gdpPerCapita');
    expect(analysis.valid).toBe(true);
    expect(analysis.variables.sort()).toEqual(['adoption', 'displacementRate', 'gdpPerCapita', 'ubiReceived']);
    expect(analysis.complexity).toBeGreaterThan(0);
  });
});

describe('allow-lists', () => {
  it('exposes the allowed variables and functions', () => {
    expect(getAllowedVariables()).toContain('adoption');
    expect(getAllowedVariables()).toContain('ubiReceived');
    expect(getAllowedFunctions()).toEqual(expect.arrayContaining(['sqrt', 'min', 'max', 'pow', 'sin']));
  });
});

describe('sandbox security', () => {
  it.each([
    ['eval("malicious code")', /forbidden pattern/],
    ['Function("return process")()', /forbidden pattern/],
    ['__proto__.polluted = 1', /forbidden pattern/],
    ['adoption = 999', /forbidden pattern|assignment/i]
  ])('blocks %s', (equation, pattern) => {
    const result = parseEquation(equation);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(pattern);
  });
});

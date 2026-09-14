import { describe, it, expect } from 'vitest';
import { usReferencePath, portStepForWorldMonth, US_REFERENCE_LAST_WORLD_MONTH } from './usReference';
import { initialRun, runMonths, initOptionsFor } from './run';
import { PRESET_MODELS, BASE_LABOR_SHARE_FOR_TESTS } from './usReference.testSupport';

const preset = PRESET_MODELS.find((m) => m.id === 'us-reference-korinek')!;

describe('US reference adapter (faithful Korinek et al. 2026)', () => {
  it('reproduces Table 3 (substantial, January 2030) at world month 60', () => {
    const p = usReferencePath('substantial').points[portStepForWorldMonth(US_REFERENCE_LAST_WORLD_MONTH)];
    expect(p.year).toBeCloseTo(2030, 9);
    expect(p.gdpGap * 100).toBeCloseTo(8.3, 1);
    expect(p.laborShare * 100).toBeCloseTo(56.1, 1);
    expect(p.unemployment * 100).toBeCloseTo(4.6, 1);
    expect(p.cognitiveUnemployment * 100).toBeCloseTo(4.5, 1);
  });

  it('records the known gap between GDP x printed labour share and the port’s labour-income series', () => {
    // The adapter feeds labour income from the port's own wage-bill series, not from this product.
    const p = usReferencePath('extreme').points[portStepForWorldMonth(US_REFERENCE_LAST_WORLD_MONTH)];
    const implied = (1 + p.gdpGap) * (p.laborShare / BASE_LABOR_SHARE_FOR_TESTS) - 1;
    expect(p.laborIncomeGap - implied).toBeGreaterThan(0.005);
  });

  it('in the world run the US follows the port exactly (no reduced-form pool on top), then stops at January 2030', () => {
    const runs = runMonths(initialRun(undefined, undefined, initOptionsFor(preset)), US_REFERENCE_LAST_WORLD_MONTH + 1, { model: preset });
    const path = usReferencePath('substantial');
    for (const m of [1, 18, 36, US_REFERENCE_LAST_WORLD_MONTH]) {
      const us = runs[m].state.countryData.USA;
      const p = path.points[portStepForWorldMonth(m)];
      expect(us.unemployment).toBe(p.unemployment);
      expect(us.gdpPerCapita / us.gdpNoAi! - 1).toBeCloseTo(p.gdpGap, 12);
      // Labour income (the anchored model's input) equals the port's labour-income series exactly.
      expect((us.gdpPerCapita * (us.laborShare! / BASE_LABOR_SHARE_FOR_TESTS)) / us.gdpNoAi! - 1).toBeCloseTo(p.laborIncomeGap, 12);
      expect(runs[m].state.outOfScope).toBeUndefined();
    }
    const after = runs[US_REFERENCE_LAST_WORLD_MONTH + 1].state;
    expect(after.outOfScope?.[0]).toMatch(/ends January 2030/);
    // Nothing is extrapolated: the US macro values are the January 2030 ones.
    expect(after.countryData.USA.unemployment).toBe(runs[US_REFERENCE_LAST_WORLD_MONTH].state.countryData.USA.unemployment);
  });

  it('other countries keep the reduced-form block; the US calibration is not applied to them', () => {
    const runs = runMonths(initialRun(undefined, undefined, initOptionsFor(preset)), 24, { model: preset });
    const deu = runs[24].state.countryData.DEU;
    const affected = deu.aiAdoption * deu.cognitiveShare!;
    expect(deu.laborShare).toBeCloseTo(BASE_LABOR_SHARE_FOR_TESTS * (1 - preset.macro!.laborShareSensitivity * affected), 12);
  });
});

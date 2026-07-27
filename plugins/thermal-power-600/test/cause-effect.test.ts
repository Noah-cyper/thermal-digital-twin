import { describe, it, expect } from 'vitest';
import { thermalCauseEffect } from '../src/cause-effect/matrices';

describe('thermal Cause & Effect (doc 09 §4) — MFT + turbine trip', () => {
  it('≥ 2 ma trận; ô trỏ tới cause/effect tồn tại; có MFT & turbine trip', () => {
    expect(thermalCauseEffect.length).toBeGreaterThanOrEqual(2);
    const ids = thermalCauseEffect.map((m) => m.matrixId);
    expect(ids).toContain('boiler-mft');
    expect(ids).toContain('turbine-trip');
    for (const m of thermalCauseEffect) {
      const causes = new Set(m.causes.map((c) => c.id));
      const effects = new Set(m.effects.map((e) => e.id));
      expect(m.cells.length).toBeGreaterThan(0);
      for (const cell of m.cells) {
        expect(causes.has(cell.cause)).toBe(true);
        expect(effects.has(cell.effect)).toBe(true);
      }
    }
  });
});

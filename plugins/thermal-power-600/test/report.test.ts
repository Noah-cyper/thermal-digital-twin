import { describe, it, expect } from 'vitest';
import type { IReportContext } from '@idtp/sdk';
import { thermalReportSections } from '../src/report/sections';

const ctx: IReportContext = { range: { from: 'F', to: 'T' }, read: async () => 100 };

describe('thermal report sections (doc 21)', () => {
  it('có ≥ 3 mục; operating-summary = bảng nhiều dòng; narrative = text; trend có tag + range', async () => {
    expect(thermalReportSections.length).toBeGreaterThanOrEqual(3);

    const sum = thermalReportSections.find((s) => s.sectionId === 'operating-summary');
    const b = (await sum?.render(ctx)) ?? [];
    expect(b[0]?.kind).toBe('table');
    if (b[0]?.kind === 'table') expect(b[0].rows.length).toBeGreaterThanOrEqual(5);

    const narr = thermalReportSections.find((s) => s.sectionId === 'narrative');
    expect((await narr?.render(ctx))?.[0]?.kind).toBe('text');

    const trend = thermalReportSections.find((s) => s.sectionId === 'trend');
    const tb = (await trend?.render(ctx))?.[0];
    expect(tb?.kind).toBe('trend');
    if (tb?.kind === 'trend') {
      expect(tb.tagIds.length).toBeGreaterThan(0);
      expect(tb.range.from).toBe('F');
    }
  });
});

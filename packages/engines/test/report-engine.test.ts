import { describe, it, expect } from 'vitest';
import type { Aggregate, IReportContext, IReportSection } from '@idtp/sdk';
import { ReportEngine } from '../src/report-engine';

const ctx: IReportContext = {
  range: { from: 'F', to: 'T' },
  read: async (_tag: string, agg: Aggregate) => (agg === 'avg' ? 10 : agg === 'min' ? 5 : 15),
};

describe('ReportEngine (doc 21) — ráp báo cáo từ section khai báo', () => {
  it('chạy section → Report có from/to + khối; đọc aggregate qua context', async () => {
    const sections: IReportSection[] = [
      {
        sectionId: 's1',
        title: { vi: 'S1', en: 'S1' },
        render: async (c) => [{ kind: 'table', headers: ['h'], rows: [['avg', String(await c.read('A', 'avg'))]] }],
      },
      { sectionId: 's2', title: { vi: 'S2', en: 'S2' }, render: async () => [{ kind: 'text', text: 'note' }] },
    ];
    const r = await new ReportEngine(sections).generate(ctx, { vi: 'R', en: 'R' });
    expect(r.from).toBe('F');
    expect(r.to).toBe('T');
    expect(r.sections.length).toBe(2);
    const t = r.sections[0]?.blocks[0];
    expect(t?.kind).toBe('table');
    if (t?.kind === 'table') expect(t.rows[0]?.[1]).toBe('10'); // read avg = 10
    expect(r.sections[1]?.blocks[0]?.kind).toBe('text');
  });
});

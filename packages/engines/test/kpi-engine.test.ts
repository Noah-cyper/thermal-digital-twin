import { describe, it, expect } from 'vitest';
import type { IKpiCalculator, IKpiInput, IKpiResult } from '@idtp/sdk';
import { MemoryHistorian } from '../src/historian';
import { KpiEngine, historianKpiInput } from '../src/kpi-engine';

const deps = { formatTs: (ms: number): string => new Date(ms).toISOString() };
const BASE = Date.parse('2026-07-24T00:00:00.000Z');
const iso = (s: number): string => new Date(BASE + s * 1000).toISOString();

const avgX: IKpiCalculator = {
  kpiId: 'avg-x',
  unit: { symbol: 'u' },
  async compute(input: IKpiInput): Promise<IKpiResult> {
    return { kpiId: 'avg-x', value: await input.read('X', 'avg'), unit: { symbol: 'u' } };
  },
};

describe('KpiEngine + historianKpiInput (doc 05-17)', () => {
  it('chạy IKpiCalculator qua Historian input (avg trên dải)', async () => {
    const h = new MemoryHistorian(deps);
    for (let i = 0; i <= 10; i++) h.write([{ tagId: 'X', value: i, quality: 'Good', ts: iso(i) }]);
    const eng = new KpiEngine([avgX]);
    const res = await eng.computeAll(historianKpiInput(h, iso(0), iso(10)));
    expect(res[0]?.kpiId).toBe('avg-x');
    expect(res[0]?.value).toBeCloseTo(5, 5);
    expect(eng.ids()).toEqual(['avg-x']);
  });

  it('historianKpiInput.read: total/last đúng trên dải', async () => {
    const h = new MemoryHistorian(deps);
    for (let i = 0; i < 5; i++) h.write([{ tagId: 'X', value: 10, quality: 'Good', ts: iso(i) }]);
    const input = historianKpiInput(h, iso(0), iso(4));
    expect(await input.read('X', 'total')).toBe(50);
    expect(await input.read('X', 'last')).toBe(10);
  });
});

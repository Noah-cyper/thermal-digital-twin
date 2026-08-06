import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { GeneratorCapabilityModel } from '../src/sim/generator-capability';

function ctxOf(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: GeneratorCapabilityModel, tags: Record<string, number>): Record<string, number> {
  const o: Record<string, number> = {};
  for (const x of m.step(ctxOf(tags)).outputs) o[x.tagId] = x.value;
  return o;
}
const OP = { GEN_MW_01: 448, GEN_MVAR_01: 277.5 }; // MVA ~527

describe('GeneratorCapabilityModel (doc 10 §7) — biểu đồ khả năng P-Q máy phát', () => {
  it('điểm vận hành: MVA ~527/667 (79%), trong biểu đồ, không giới hạn ràng buộc, lành mạnh', () => {
    const m = new GeneratorCapabilityModel();
    m.init();
    const o = one(m, OP);
    expect(o.GCAP_MVA_01).toBeCloseTo(527, -1);
    expect(o.GCAP_MVA_RATED_01).toBe(667);
    expect(o.GCAP_MVA_LOADING_01).toBeGreaterThan(75);
    expect(o.GCAP_MVA_LOADING_01).toBeLessThan(85);
    expect(o.GCAP_Q_MARGIN_01).toBeGreaterThan(30);
    expect(o.GCAP_LIMIT_BINDING_01).toBe(0); // không giới hạn nào ràng buộc
    expect(o.GCAP_HEALTHY_01).toBe(1);
  });

  it('stator-cooling-loss: derate MVA → tải MVA >100% → giới hạn STATOR ràng buộc, không lành mạnh', () => {
    const m = new GeneratorCapabilityModel();
    m.init();
    m.injectMalfunction({ id: 'stator-cooling-loss' });
    const o = one(m, OP);
    expect(o.GCAP_MVA_RATED_01).toBeLessThan(667);
    expect(o.GCAP_MVA_LOADING_01).toBeGreaterThan(100);
    expect(o.GCAP_LIMIT_BINDING_01).toBe(1); // stator
    expect(o.GCAP_HEALTHY_01).toBe(0);
  });

  it('field-cooling-loss: thu hẹp trần quá kích → biên Q nhỏ → giới hạn FIELD ràng buộc, không lành mạnh', () => {
    const m = new GeneratorCapabilityModel();
    m.init();
    const base = one(m, OP);
    m.injectMalfunction({ id: 'field-cooling-loss' });
    const o = one(m, OP);
    expect(o.GCAP_Q_OVER_LIMIT_01).toBeLessThan(base.GCAP_Q_OVER_LIMIT_01);
    expect(o.GCAP_Q_MARGIN_01).toBeLessThan(30);
    expect(o.GCAP_LIMIT_BINDING_01).toBe(2); // field/over-exc
    expect(o.GCAP_HEALTHY_01).toBe(0);
  });

  it('phía THIẾU kích (Q âm sâu): giới hạn under-excitation ràng buộc', () => {
    const m = new GeneratorCapabilityModel();
    m.init();
    const o = one(m, { GEN_MW_01: 448, GEN_MVAR_01: -190 }); // gần sàn −200
    expect(o.GCAP_LIMIT_BINDING_01).toBe(3); // under-exc
    expect(o.GCAP_HEALTHY_01).toBe(0);
  });

  it('snapshot/restore giữ cờ derate làm mát (OTS)', () => {
    const m = new GeneratorCapabilityModel();
    m.init();
    m.injectMalfunction({ id: 'stator-cooling-loss' });
    one(m, OP);
    const snap = m.snapshot();
    const m2 = new GeneratorCapabilityModel();
    m2.init();
    m2.restore(snap);
    const o = one(m2, OP);
    expect(o.GCAP_MVA_RATED_01).toBeLessThan(667); // vẫn derate sau restore
    expect(m2.snapshot().state.statorDerate).toBe(1);
  });
});

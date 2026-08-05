import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { AvrExcitationModel } from '../src/sim/avr-excitation';

function ctxOf(tags: Record<string, number>, dtMs = 100): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: AvrExcitationModel, tags: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags)).outputs) out[o.tagId] = o.value;
  return out;
}
function settle(m: AvrExcitationModel, tags: Record<string, number>, n = 60): Record<string, number> {
  let o: Record<string, number> = {};
  for (let i = 0; i < n; i++) o = one(m, tags);
  return o;
}

describe('AvrExcitationModel (doc 10 §7) — AVR & hệ kích từ máy phát', () => {
  it('điểm vận hành: điện áp cực 20 kV (1,0 pu), AUTO, dòng kích từ ~3000 A, kích thích ~75%, phản kháng ≈ GEN_MVAR', () => {
    const m = new AvrExcitationModel();
    m.init();
    const o = settle(m, { GEN_MVAR_01: 277.68 });
    expect(o.ELEC_TERM_VOLT_01).toBeCloseTo(20, 1);
    expect(o.ELEC_TERM_VOLT_PU_01).toBeCloseTo(1.0, 2);
    expect(o.ELEC_AVR_MODE_01).toBe(1);
    expect(o.ELEC_FIELD_CURRENT_01).toBeCloseTo(3000, -2); // ~3000 A
    expect(o.ELEC_EXCITATION_01).toBeGreaterThan(70);
    expect(o.ELEC_EXCITATION_01).toBeLessThan(80);
    expect(o.ELEC_REACTIVE_AVR_01).toBeCloseTo(277.68, 0);
  });

  it('lưới sụt (grid-undervoltage): AVR tăng kích từ + phản kháng đỡ áp, GIỮ điện áp cực ~1,0 pu', () => {
    const m = new AvrExcitationModel();
    m.init();
    const base = settle(m, { GEN_MVAR_01: 277.68 });
    m.injectMalfunction({ id: 'grid-undervoltage' });
    const o = settle(m, { GEN_MVAR_01: 277.68 });
    expect(o.ELEC_TERM_VOLT_PU_01).toBeCloseTo(1.0, 2); // AVR vẫn giữ điện áp cực
    expect(o.ELEC_FIELD_CURRENT_01).toBeGreaterThan(base.ELEC_FIELD_CURRENT_01); // kích từ tăng
    expect(o.ELEC_REACTIVE_AVR_01).toBeGreaterThan(base.ELEC_REACTIVE_AVR_01); // huy động MVAr đỡ áp
  });

  it('AVR MANUAL + lưới sụt: mất điều áp → điện áp cực TRÔI theo lưới (sag), mode = 0', () => {
    const m = new AvrExcitationModel();
    m.init();
    settle(m, { GEN_MVAR_01: 277.68 });
    m.injectMalfunction({ id: 'avr-manual' });
    m.injectMalfunction({ id: 'grid-undervoltage' });
    const o = settle(m, { GEN_MVAR_01: 277.68 });
    expect(o.ELEC_AVR_MODE_01).toBe(0);
    expect(o.ELEC_TERM_VOLT_PU_01).toBeLessThan(0.97); // trôi về lưới ~0,94, không còn giữ 1,0
  });

  it('snapshot/restore giữ dòng kích từ + điện áp cực (OTS)', () => {
    const m = new AvrExcitationModel();
    m.init();
    m.injectMalfunction({ id: 'grid-undervoltage' });
    settle(m, { GEN_MVAR_01: 277.68 }, 30);
    const snap = m.snapshot();
    const m2 = new AvrExcitationModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.field).toBeCloseTo(snap.state.field as number, 6);
    expect(m2.snapshot().state.vTermPu).toBeCloseTo(snap.state.vTermPu as number, 6);
  });
});

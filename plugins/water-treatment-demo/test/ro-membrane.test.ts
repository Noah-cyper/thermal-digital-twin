// Plugin #2 mở rộng ĐỘC LẬP (doc 00 §5.4): thêm quá trình VẬT LÝ KHÁC (màng RO) + alarm RO chạy trên
// ĐÚNG engine chung (SimulationHost + AlarmEngine) — KHÔNG sửa packages/* & apps/*. Củng cố luận điểm
// "mọi nhà máy chỉ là plugin": plugin lớn thêm mà kernel/engine bất động.
import { describe, it, expect } from 'vitest';
import { SimulationHost, TagRealtimeEngine, AlarmEngine } from '@idtp/engines';
import { RoMembraneModel, waterAlarms } from '../src/index';

const TS = '2026-07-24T10:00:00+07:00';

function build(feed = 160): {
  step: (n?: number) => void;
  num: (id: string) => number;
  model: RoMembraneModel;
  alarms: AlarmEngine;
} {
  const tag = new TagRealtimeEngine();
  const num = (id: string): number => {
    const v = tag.getCurrent(id);
    return typeof v?.value === 'number' ? v.value : 0;
  };
  const put = (id: string, value: number): void => tag.ingest([{ tagId: id, value, quality: 'Good', ts: TS }]);
  put('WTP_FEED_FLOW_01', feed); // cấp cho RO (từ bể — ở đây cố định)

  const host = new SimulationHost(60_000, {
    now: () => TS,
    getTag: num,
    onOutputs: (outs) => tag.ingest(outs.map((o) => ({ tagId: o.tagId, value: o.value, quality: o.quality, ts: TS }))),
  });
  const model = new RoMembraneModel();
  host.register(model);
  const alarms = new AlarmEngine(waterAlarms, { formatTs: (x) => `t${x}` });
  const roTags = ['WTP_RO_PERM_COND_01', 'WTP_RO_DP_01'];
  let ms = 0;
  const step = (n = 1): void => {
    for (let i = 0; i < n; i++) {
      ms += 60_000;
      host.step();
      for (const t of roTags) alarms.evaluate(t, num(t), 'Good', ms);
    }
  };
  return { step, num, model, alarms };
}

describe('RoMembraneModel + alarm RO trên engine chung (0 dòng sửa packages/* & apps/*)', () => {
  it('điểm vận hành: thu hồi ~75%, khử muối ~99%, độ dẫn permeate thấp, màng bình thường', () => {
    const w = build(160);
    w.step(3);
    expect(w.num('WTP_RO_RECOVERY_01')).toBeGreaterThan(70);
    expect(w.num('WTP_RO_PERMEATE_FLOW_01')).toBeCloseTo(120, -1); // 0,75 × 160
    expect(w.num('WTP_RO_SALT_REJECT_01')).toBeGreaterThan(99);
    expect(w.num('WTP_RO_PERM_COND_01')).toBeLessThan(15);
    expect(w.num('WTP_RO_HEALTHY_01')).toBe(1);
  });

  it('membrane-breach: khử muối tụt → độ dẫn permeate VỌT → alarm WTP-RO-COND-HI (AlarmEngine chung)', () => {
    const w = build(160);
    w.step(2);
    w.model.injectMalfunction({ id: 'membrane-breach' });
    w.step(5);
    expect(w.num('WTP_RO_SALT_REJECT_01')).toBeLessThan(95);
    expect(w.num('WTP_RO_PERM_COND_01')).toBeGreaterThan(15);
    expect(w.num('WTP_RO_HEALTHY_01')).toBe(0);
    expect(w.alarms.getActive().some((a) => a.alarmId === 'WTP-RO-COND-HI')).toBe(true);
  });

  it('membrane-fouling ĐỘNG: ΔP tăng theo thời gian → alarm WTP-RO-DP-HI, thu hồi giảm', () => {
    const w = build(160);
    w.step(2);
    const dp0 = w.num('WTP_RO_DP_01');
    const rec0 = w.num('WTP_RO_RECOVERY_01');
    w.model.injectMalfunction({ id: 'membrane-fouling' });
    w.step(110); // ~110 phút tích bám → ΔP vượt 3,5 bar (ngưỡng CIP)
    expect(w.num('WTP_RO_DP_01')).toBeGreaterThan(dp0 + 1);
    expect(w.num('WTP_RO_RECOVERY_01')).toBeLessThan(rec0);
    expect(w.alarms.getActive().some((a) => a.alarmId === 'WTP-RO-DP-HI')).toBe(true);
  });

  it('snapshot/restore giữ bám màng + cờ sự cố (OTS)', () => {
    const w = build(160);
    w.model.injectMalfunction({ id: 'membrane-fouling' });
    w.step(20);
    const snap = w.model.snapshot();
    const m2 = new RoMembraneModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.fouling).toBeCloseTo(snap.state.fouling as number, 6);
    expect(m2.snapshot().state.foulingActive).toBe(1);
  });
});

import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { EmergencyPowerModel } from '../src/sim/emergency-power';

function ctxOf(tags: Record<string, number>, dtMs = 100): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: EmergencyPowerModel, tags: Record<string, number>, dtMs?: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags, dtMs)).outputs) out[o.tagId] = o.value;
  return out;
}

describe('EmergencyPowerModel (doc 10 §7 BOP) — Diesel khẩn cấp + UPS/ắc-quy DC', () => {
  it('điểm vận hành (lưới tự dùng còn): EDG dừng-sẵn sàng, UPS nạp nổi (SOC 100%, DC 220/110 V)', () => {
    const m = new EmergencyPowerModel();
    m.init();
    const o = one(m, { GEN_MW_01: 448 });
    expect(o.EDG_RUNNING_01).toBe(0);
    expect(o.EDG_READY_01).toBe(1);
    expect(o.EDG_LOAD_01).toBe(0);
    expect(o.UPS_ON_BATTERY_01).toBe(0);
    expect(o.UPS_BATT_SOC_01).toBe(100);
    expect(o.UPS_DC220_VOLT_01).toBeCloseTo(220, 1);
    expect(o.UPS_DC110_VOLT_01).toBeCloseTo(110, 1);
  });

  it('mất điện tự dùng (station-blackout): EDG tự chạy mang tải, UPS chuyển ắc-quy → SOC giảm dần', () => {
    const m = new EmergencyPowerModel();
    m.init();
    m.injectMalfunction({ id: 'station-blackout' });
    const o0 = one(m, { GEN_MW_01: 0 });
    expect(o0.EDG_RUNNING_01).toBe(1);
    expect(o0.EDG_LOAD_01).toBeGreaterThan(0);
    expect(o0.UPS_ON_BATTERY_01).toBe(1);
    // 2 giờ xả → SOC tụt rõ rệt, DC sụt.
    for (let i = 0; i < 120; i++) one(m, { GEN_MW_01: 0 }, 60_000);
    const o = one(m, { GEN_MW_01: 0 }, 60_000);
    expect(o.UPS_BATT_SOC_01).toBeLessThan(60);
    expect(o.UPS_DC220_VOLT_01).toBeLessThan(220);
    expect(o.EDG_FUEL_TANK_01).toBeLessThan(95);
  });

  it('khôi phục điện: EDG dừng, UPS nạp nổi lại → SOC hồi phục', () => {
    const m = new EmergencyPowerModel();
    m.init();
    m.injectMalfunction({ id: 'station-blackout' });
    for (let i = 0; i < 120; i++) one(m, { GEN_MW_01: 0 }, 60_000);
    m.clearMalfunction('station-blackout');
    for (let i = 0; i < 120; i++) one(m, { GEN_MW_01: 448 }, 60_000);
    const o = one(m, { GEN_MW_01: 448 });
    expect(o.EDG_RUNNING_01).toBe(0);
    expect(o.UPS_ON_BATTERY_01).toBe(0);
    expect(o.UPS_BATT_SOC_01).toBeGreaterThan(90);
  });

  it('snapshot/restore giữ SOC + dầu (OTS)', () => {
    const m = new EmergencyPowerModel();
    m.init();
    m.injectMalfunction({ id: 'station-blackout' });
    for (let i = 0; i < 60; i++) one(m, { GEN_MW_01: 0 }, 60_000);
    const snap = m.snapshot();
    const m2 = new EmergencyPowerModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.soc).toBeCloseTo(snap.state.soc as number, 6);
    expect(m2.snapshot().state.fuel).toBeCloseTo(snap.state.fuel as number, 6);
  });
});

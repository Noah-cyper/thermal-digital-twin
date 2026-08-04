import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { FireFightingModel } from '../src/sim/fire-fighting';

function ctxOf(tags: Record<string, number>, dtMs = 100): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: FireFightingModel, tags: Record<string, number> = {}, dtMs?: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags, dtMs)).outputs) out[o.tagId] = o.value;
  return out;
}

describe('FireFightingModel (doc 10 §10 BOP) — hệ chữa cháy', () => {
  it('trạng thái thường: vòng ống giữ ~9 barg, bồn đầy, không báo cháy, bơm chính dừng, đủ vùng', () => {
    const m = new FireFightingModel();
    m.init();
    for (let i = 0; i < 50; i++) one(m);
    const o = one(m);
    expect(o.FIRE_RINGMAIN_PRESS_01).toBeGreaterThan(8.5);
    expect(o.FIRE_ALARM_ACTIVE_01).toBe(0);
    expect(o.FIRE_MAIN_PUMP_RUNNING_01).toBe(0);
    expect(o.FIRE_ZONES_NORMAL_01).toBe(24);
    expect(o.FIRE_TANK_LEVEL_01).toBeGreaterThan(90);
  });

  it('phát hiện cháy (fire-detected): báo cháy, bơm chính chạy, áp vòng ống tụt, bồn rút nước', () => {
    const m = new FireFightingModel();
    m.init();
    for (let i = 0; i < 50; i++) one(m);
    m.injectMalfunction({ id: 'fire-detected' });
    for (let i = 0; i < 60; i++) one(m, {}, 60_000);
    const o = one(m, {}, 60_000);
    expect(o.FIRE_ALARM_ACTIVE_01).toBe(1);
    expect(o.FIRE_MAIN_PUMP_RUNNING_01).toBe(1);
    expect(o.FIRE_ZONES_NORMAL_01).toBe(23);
    expect(o.FIRE_RINGMAIN_PRESS_01).toBeLessThan(8.5);
    expect(o.FIRE_TANK_LEVEL_01).toBeLessThan(96);
  });

  it('hết cháy: áp vòng ống hồi ~9 barg, báo cháy tắt', () => {
    const m = new FireFightingModel();
    m.init();
    m.injectMalfunction({ id: 'fire-detected' });
    for (let i = 0; i < 30; i++) one(m, {}, 60_000);
    m.clearMalfunction('fire-detected');
    for (let i = 0; i < 60; i++) one(m);
    const o = one(m);
    expect(o.FIRE_ALARM_ACTIVE_01).toBe(0);
    expect(o.FIRE_RINGMAIN_PRESS_01).toBeGreaterThan(8.5);
  });

  it('snapshot/restore giữ áp vòng ống + mức bồn (OTS)', () => {
    const m = new FireFightingModel();
    m.init();
    m.injectMalfunction({ id: 'fire-detected' });
    for (let i = 0; i < 30; i++) one(m, {}, 60_000);
    const snap = m.snapshot();
    const m2 = new FireFightingModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.tankPct).toBeCloseTo(snap.state.tankPct as number, 6);
    expect(m2.snapshot().state.ringPress).toBeCloseTo(snap.state.ringPress as number, 6);
  });
});

import { describe, it, expect } from 'vitest';
import type { ISimModelContext } from '@idtp/sdk';
import { WaterTreatmentModel } from '../src/sim/water-treatment';

function ctxOf(tags: Record<string, number>, dtMs = 100): ISimModelContext {
  return { dtMs, getTag: (id: string) => tags[id] ?? 0, now: () => '2026-07-24T03:00:00.000+07:00' };
}
function one(m: WaterTreatmentModel, tags: Record<string, number>, dtMs?: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of m.step(ctxOf(tags, dtMs)).outputs) out[o.tagId] = o.value;
  return out;
}
function runUntil(m: WaterTreatmentModel, tags: Record<string, number>, pred: (o: Record<string, number>) => boolean, maxSteps = 3000): Record<string, number> {
  let o: Record<string, number> = {};
  for (let i = 0; i < maxSteps; i++) { o = one(m, tags, 60_000); if (pred(o)) break; }
  return o;
}

describe('WaterTreatmentModel (doc 10 §10 BOP) — xử lý nước khử khoáng DM', () => {
  it('điểm vận hành: nước bù ≈ 1,2% hơi, sản xuất chạy, nước DM chất lượng cao (độ dẫn/silica thấp), 3 dây chuyền', () => {
    const m = new WaterTreatmentModel();
    m.init();
    const o = one(m, { BLR_STEAM_FLOW_01: 1500 });
    expect(o.WT_MAKEUP_FLOW_01).toBeCloseTo(18, 0); // 1,2% × 1500
    expect(o.WT_DM_PRODUCTION_01).toBeGreaterThan(0);
    expect(o.WT_PRODUCT_COND_01).toBeCloseTo(0.08, 2); // nhựa còn tốt → độ dẫn thấp
    expect(o.WT_SILICA_01).toBeCloseTo(5, 0);
    expect(o.WT_TRAINS_INSERVICE_01).toBe(3);
    expect(o.WT_DM_TANK_LEVEL_01).toBeGreaterThan(40);
  });

  it('hơi thổi bụi không hồi làm tăng nhu cầu bù', () => {
    const m = new WaterTreatmentModel();
    m.init();
    const base = one(m, { BLR_STEAM_FLOW_01: 1500 });
    const m2 = new WaterTreatmentModel();
    m2.init();
    const withSoot = one(m2, { BLR_STEAM_FLOW_01: 1500, SB_STEAM_FLOW_01: 12 });
    expect(withSoot.WT_MAKEUP_FLOW_01).toBeCloseTo(base.WT_MAKEUP_FLOW_01 + 12, 1);
  });

  it('nhựa cạn theo thông lượng → tái sinh: một dây chuyền offline, sau đó nạp lại (tải nhựa reset)', () => {
    const m = new WaterTreatmentModel();
    m.init();
    const inRegen = runUntil(m, { BLR_STEAM_FLOW_01: 1500 }, (o) => o.WT_REGEN_ACTIVE_01 === 1);
    expect(inRegen.WT_REGEN_ACTIVE_01).toBe(1);
    expect(inRegen.WT_TRAINS_INSERVICE_01).toBe(2); // 1 dây chuyền đang tái sinh
    const afterRegen = runUntil(m, { BLR_STEAM_FLOW_01: 1500 }, (o) => o.WT_REGEN_ACTIVE_01 === 0);
    expect(afterRegen.WT_REGEN_ACTIVE_01).toBe(0);
    expect(afterRegen.WT_RESIN_LOADING_01).toBeLessThan(20); // nhựa vừa tái sinh
    expect(afterRegen.WT_TRAINS_INSERVICE_01).toBe(3);
  });

  it('malfunction dm-resin-fault: độ dẫn & silica cao (rò ion) dù nhựa chưa cạn', () => {
    const m = new WaterTreatmentModel();
    m.init();
    m.injectMalfunction({ id: 'dm-resin-fault' });
    const o = one(m, { BLR_STEAM_FLOW_01: 1500 });
    expect(o.WT_PRODUCT_COND_01).toBeGreaterThan(0.5);
    expect(o.WT_SILICA_01).toBeGreaterThan(20);
    m.clearMalfunction('dm-resin-fault');
    const o2 = one(m, { BLR_STEAM_FLOW_01: 1500 });
    expect(o2.WT_PRODUCT_COND_01).toBeCloseTo(0.08, 2);
  });

  it('snapshot/restore giữ mức bồn + tải nhựa (OTS)', () => {
    const m = new WaterTreatmentModel();
    m.init();
    for (let i = 0; i < 200; i++) one(m, { BLR_STEAM_FLOW_01: 1500 }, 60_000);
    const snap = m.snapshot();
    const m2 = new WaterTreatmentModel();
    m2.init();
    m2.restore(snap);
    expect(m2.snapshot().state.tankLevel).toBeCloseTo(snap.state.tankLevel as number, 6);
    expect(m2.snapshot().state.resinLoading).toBeCloseTo(snap.state.resinLoading as number, 6);
  });
});

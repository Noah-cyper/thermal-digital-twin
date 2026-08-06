import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

// Hardening (E): (1) load-following 448→560→400 MW — toàn hệ (lõi + chiều sâu) BÁM tải, mọi tag hữu hạn,
// không trip giả; (2) OTS freeze + snapshot/restore round-trip — đóng băng dừng tiến; restore khôi phục
// trạng thái model chiều sâu (xác định lại được).
const DEPTH_TAGS = [
  'GEN_MW_01', 'BLR_STEAM_FLOW_01', 'BLR_COAL_FLOW_01', 'PVM_RUNNING_01', 'PVM_MAX_LOAD_01',
  'GOV_VALVE_POS_01', 'AGC_SETPOINT_01', 'CMB_BOILER_EFF_EST_01', 'HTR_WORST_TTD_01',
  'DRM_SWELL_MM_01', 'PSS_DAMPING_RATIO_01', 'ELEC_NET_MW_01',
];

describe('thermal-runtime — load-following & OTS (hardening E)', () => {
  it('load-following 448→560→400: công suất bám tải, mọi tag chiều sâu hữu hạn, không trip giả', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    const mw0 = rt.value('GEN_MW_01');
    expect(mw0).toBeGreaterThan(400);

    // Tăng tải → 560 MW.
    rt.setLoadDemand(560);
    for (let i = 0; i < 3000; i++) rt.step();
    const mwUp = rt.value('GEN_MW_01');
    expect(mwUp).toBeGreaterThan(mw0 + 40); // đã tăng đáng kể
    expect(rt.value('BLR_COAL_FLOW_01')).toBeGreaterThan(230); // than tăng theo tải
    expect(rt.value('TRB_TRIP')).toBeLessThan(0.5); // không trip

    // Giảm tải → 400 MW.
    rt.setLoadDemand(400);
    for (let i = 0; i < 3000; i++) rt.step();
    const mwDn = rt.value('GEN_MW_01');
    expect(mwDn).toBeLessThan(mwUp - 40); // đã giảm

    // Mọi tag chiều sâu hữu hạn suốt hành trình.
    for (const t of DEPTH_TAGS) expect(Number.isFinite(rt.value(t)), `tag ${t} hữu hạn`).toBe(true);
    expect(rt.value('PVM_RUNNING_01')).toBeGreaterThanOrEqual(1);
    expect(rt.value('CMB_BOILER_EFF_EST_01')).toBeGreaterThan(80);
  });

  it('OTS freeze: đóng băng dừng tiến sim (tag không đổi giữa 2 lần step khi frozen)', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    rt.freeze(true);
    expect(rt.isFrozen()).toBe(true);
    const before = rt.value('GEN_MW_01');
    for (let i = 0; i < 50; i++) rt.step();
    expect(rt.value('GEN_MW_01')).toBe(before); // đóng băng: không đổi
    rt.freeze(false);
    expect(rt.isFrozen()).toBe(false);
  });

  it('OTS snapshot/restore: khôi phục trạng thái sau khi tiêm sự cố chiều sâu', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    const snap = rt.snapshot();
    const millBefore = rt.value('PVM_RUNNING_01');

    // Tiêm sự cố: trip máy nghiền + lọt khí → trạng thái đổi.
    rt.injectMalfunction({ id: 'mill-a-trip' });
    rt.injectMalfunction({ id: 'condenser-air-leak' });
    for (let i = 0; i < 300; i++) rt.step();
    expect(rt.value('PVM_RUNNING_01')).toBeLessThan(millBefore); // 1 máy đã trip

    // Restore về ảnh chụp → máy nghiền chạy lại như trước.
    rt.restore(snap);
    for (let i = 0; i < 20; i++) rt.step();
    expect(rt.value('PVM_RUNNING_01')).toBe(millBefore);
  });
});

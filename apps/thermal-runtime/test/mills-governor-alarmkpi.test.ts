import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import { boilerScreens, screenTags, thermalNav } from '@idtp/plugin-thermal-power-600';

// Chiều sâu vòng 1-2-3: máy nghiền per-mill + điều tốc droop/PFR + KPI hiệu năng alarm (EEMUA-191).
// 0 hồi quy: models đọc-only sinh tag mới (PVM_*/GOV_*/ALM_*); KPI alarm đọc engine, không đụng process.
describe('thermal-runtime — mills · governor · alarm-KPI (chiều sâu)', () => {
  it('máy nghiền per-mill sống: 4 máy chạy, mill-a-trip → quá tải + độ mịn tụt', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    expect(rt.value('PVM_RUNNING_01')).toBe(4);
    expect(rt.value('PVM_HEALTHY_01')).toBe(1);
    const fineBase = rt.value('PVM_MIN_FINENESS_01');
    rt.injectMalfunction({ id: 'mill-a-trip' });
    for (let i = 0; i < 10; i++) rt.step();
    expect(rt.value('PVM_A_STATUS_01')).toBe(2);
    expect(rt.value('PVM_MAX_LOAD_01')).toBeGreaterThan(100);
    expect(rt.value('PVM_MIN_FINENESS_01')).toBeLessThan(fineBase);
    expect(rt.value('PVM_HEALTHY_01')).toBe(0);
  });

  it('điều tốc droop sống: điểm vận hành trong deadband; under-frequency → PFR > 0', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    expect(rt.value('GOV_ENABLED_01')).toBe(1);
    expect(rt.value('GOV_DEADBAND_ACTIVE_01')).toBe(1);
    expect(Math.abs(rt.value('GOV_PFR_MW_01'))).toBeLessThan(1);
    rt.injectMalfunction({ id: 'grid-underfrequency' });
    for (let i = 0; i < 400; i++) rt.step();
    expect(rt.value('GOV_PFR_MW_01')).toBeGreaterThan(20);
    expect(rt.value('GOV_GRID_FREQ_01')).toBeLessThan(49.9);
  });

  it('KPI hiệu năng alarm (EEMUA-191) sống: nền yên; bơm sự cố → suất/hoạt động tăng', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 100; i++) rt.step();
    expect(rt.value('ALM_FLOOD_01')).toBe(0);
    expect(rt.value('ALM_EEMUA_OK_01')).toBe(1);

    rt.injectMalfunction({ id: 'feedwater-pump-trip' }); // gây loạt alarm mức bao hơi
    for (let i = 0; i < 200; i++) rt.step();
    expect(rt.value('ALM_ACTIVE_01')).toBeGreaterThan(0);
    expect(rt.value('ALM_RATE_10MIN_01')).toBeGreaterThan(0);
  });

  it('màn D3-governor-droop · D3-pulverizer-mills · D2-alarm-performance có trong screens + nav; tag sống', () => {
    const ids = ['D3-governor-droop', 'D3-pulverizer-mills', 'D2-alarm-performance'];
    const rt = createThermalRuntime();
    for (let i = 0; i < 200; i++) rt.step();
    for (const id of ids) {
      const scr = boilerScreens.find((s) => s.screenId === id);
      expect(scr, `màn ${id}`).toBeDefined();
      expect(thermalNav.some((n) => n.screenId === id), `nav ${id}`).toBe(true);
      if (!scr) continue;
      for (const t of screenTags(scr)) {
        expect(Number.isFinite(rt.value(t)), `tag ${t} (màn ${id}) phải sống`).toBe(true);
      }
    }
  });
});

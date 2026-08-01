import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import { thermalNav, boilerScreens } from '@idtp/plugin-thermal-power-600';

describe('thermal-runtime — BOP §10 (v1.40): khí nén · dầu đốt khởi động · thải tro', () => {
  it('khí nén: bình chứa trong dải, header IA có áp, dewpoint sấy âm, ≥1 máy nén chạy', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step();
    expect(rt.value('CA_RECEIVER_PRESS_01')).toBeGreaterThan(6);
    expect(rt.value('CA_RECEIVER_PRESS_01')).toBeLessThan(8);
    expect(rt.value('CA_IA_HEADER_PRESS_01')).toBeGreaterThan(5.5);
    expect(rt.value('CA_IA_DEWPOINT_01')).toBeLessThan(0); // sấy → dewpoint âm sâu
    expect(rt.value('CA_COMP_RUNNING_01')).toBeGreaterThan(0);
    expect(rt.value('CA_DEMAND_01')).toBeGreaterThan(20);
  });

  it('dầu đốt: ở tải than cao lưu lượng dầu = 0 (súng rút), HFO hâm ~120 °C, bồn còn nhiều', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step();
    expect(rt.value('BLR_COAL_FLOW_01')).toBeGreaterThan(60); // than cao → không đốt dầu
    expect(rt.value('FO_FLOW_01')).toBeLessThan(0.1);
    expect(rt.value('FO_HFO_TEMP_01')).toBeGreaterThan(110);
    expect(rt.value('FO_HFO_TANK_LEVEL_01')).toBeGreaterThan(50);
  });

  it('thải tro: tổng tro = than×15%, tro đáy < tro bay, silo có mức, phễu ESP giảm dần A→C', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 400; i++) rt.step();
    const coal = rt.value('BLR_COAL_FLOW_01');
    expect(rt.value('ASH_TOTAL_01')).toBeGreaterThan(coal * 0.14);
    expect(rt.value('ASH_TOTAL_01')).toBeLessThan(coal * 0.16);
    expect(rt.value('ASH_BOTTOM_FLOW_01')).toBeLessThan(rt.value('ASH_FLY_FLOW_01'));
    expect(rt.value('ASH_SILO_LEVEL_01')).toBeGreaterThan(0);
    expect(rt.value('ASH_ESP_HOP_A_01')).toBeGreaterThan(rt.value('ASH_ESP_HOP_C_01'));
  });

  it('breadth: 3 màn hình BOP mới có trong registry + cây điều hướng', () => {
    const ids = new Set(boilerScreens.map((s) => s.screenId));
    const navIds = new Set(thermalNav.map((n) => n.screenId));
    for (const s of ['D3-compressed-air', 'D3-fuel-oil', 'D3-ash-handling']) {
      expect(ids.has(s)).toBe(true); // có screen khai báo
      expect(navIds.has(s)).toBe(true); // có trong cây điều hướng
    }
    expect(boilerScreens.length).toBeGreaterThanOrEqual(23); // 20 → 23 màn hình
  });
});

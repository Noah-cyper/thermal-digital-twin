import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import { boilerScreens, thermalNav } from '@idtp/plugin-thermal-power-600';

describe('thermal-runtime — hiệu chỉnh hiệu năng (c, v1.42): lượng hoá độ lệch vs Design Basis', () => {
  it('độ lệch KPI phơi bày đúng các gap tài liệu (heat rate/hiệu suất/CW nhiệt đới), khép NL tốt', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();

    // Mốc Design Basis phát ra đúng hằng số.
    expect(rt.value('PLANT_CAL_HR_TGT_01')).toBe(9200);
    expect(rt.value('PLANT_CAL_EFF_TGT_01')).toBe(39);
    expect(rt.value('PLANT_CAL_CW_TGT_01')).toBe(19);

    // GĐ-68: mô hình đốt than nhiều hơn mốc → heat rate KÉM hơn (dev dương), hiệu suất THẤP hơn (dev âm).
    expect(rt.value('PLANT_CAL_HR_DEV_01')).toBeGreaterThan(0);
    expect(rt.value('PLANT_CAL_EFF_DEV_01')).toBeLessThan(0);
    // Nhất quán: heat rate kém ⇔ hiệu suất thấp (cùng dấu ngược nhau).
    expect(Math.abs(rt.value('PLANT_CAL_HR_DEV_01'))).toBeGreaterThan(5); // gap thực chất, không phải nhiễu

    // GĐ-67: bầu ướt nhiệt đới → CW cấp NÓNG hơn mốc ôn hoà (dev dương) → đẩy back-pressure.
    expect(rt.value('PLANT_CAL_CW_DEV_01')).toBeGreaterThan(5);

    // Khép cân bằng năng lượng ĐẠT (kiểm toán độc lập nguồn đúng) → độ lệch khép ≈ 0.
    expect(Math.abs(rt.value('PLANT_CAL_CLOSURE_DEV_01'))).toBeLessThan(3);
  });

  it('điều kiện hơi/chân không ĐƯỢC ĐIỀU KHIỂN ở đúng điểm thiết kế (độ lệch ≈ 0) → khu biệt gap heat-rate KHÔNG do sai điều kiện hơi', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();

    // Mốc thiết kế phát ra đúng hằng số.
    expect(rt.value('PLANT_CAL_MST_TGT_01')).toBe(541);
    expect(rt.value('PLANT_CAL_HRH_TGT_01')).toBe(541);
    expect(rt.value('PLANT_CAL_MSP_TGT_01')).toBe(17.5);
    expect(rt.value('PLANT_CAL_VAC_TGT_01')).toBe(5.4);

    // Các biến ĐƯỢC ĐIỀU KHIỂN bám sát điểm thiết kế → độ lệch nhỏ (chứng minh sim ở đúng điều kiện hơi).
    expect(Math.abs(rt.value('PLANT_CAL_MST_DEV_01'))).toBeLessThan(2); // °C
    expect(Math.abs(rt.value('PLANT_CAL_HRH_DEV_01'))).toBeLessThan(3); // °C
    expect(Math.abs(rt.value('PLANT_CAL_MSP_DEV_01'))).toBeLessThan(0.3); // MPa
    expect(Math.abs(rt.value('PLANT_CAL_VAC_DEV_01'))).toBeLessThan(1); // kPa

    // Tương phản: heat rate/η vẫn lệch LỚN (gap thực chất) trong khi điều kiện hơi ĐÚNG →
    // gap KHÔNG do sai điều kiện hơi mà do hằng số coal→steam→MW (đúng chẩn đoán M-06, cần số vận hành thật).
    expect(rt.value('PLANT_CAL_HR_DEV_01')).toBeGreaterThan(10);
  });

  it('màn hình + nav hiệu chỉnh có mặt', () => {
    const ids = new Set(boilerScreens.map((s) => s.screenId));
    const navIds = new Set(thermalNav.map((n) => n.screenId));
    expect(ids.has('D2-calibration')).toBe(true);
    expect(navIds.has('D2-calibration')).toBe(true);
  });
});

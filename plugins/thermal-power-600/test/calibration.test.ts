import { describe, it, expect } from 'vitest';
import type { ISimModelContext, ISimStepResult } from '@idtp/sdk';
import { CalibrationModel } from '../src/sim/calibration';

function mkCtx(tags: Record<string, number>): ISimModelContext {
  return { dtMs: 100, getTag: (id) => tags[id] ?? 0, now: () => '2026-08-01T10:00:00+07:00' };
}
function step(tags: Record<string, number>): ISimStepResult {
  const m = new CalibrationModel();
  m.init();
  return m.step(mkCtx(tags));
}
const v = (r: ISimStepResult, t: string): number => r.outputs.find((o) => o.tagId === t)?.value ?? NaN;

describe('CalibrationModel (doc 25) — lượng hoá độ lệch vs Design Basis', () => {
  it('mốc phát ra đúng hằng số Design Basis', () => {
    const r = step({});
    expect(v(r, 'PLANT_CAL_HR_TGT_01')).toBe(9200);
    expect(v(r, 'PLANT_CAL_EFF_TGT_01')).toBe(39);
    expect(v(r, 'PLANT_CAL_CW_TGT_01')).toBe(19);
    expect(v(r, 'PLANT_CAL_MST_TGT_01')).toBe(541);
    expect(v(r, 'PLANT_CAL_HRH_TGT_01')).toBe(541);
    expect(v(r, 'PLANT_CAL_MSP_TGT_01')).toBe(17.5);
    expect(v(r, 'PLANT_CAL_VAC_TGT_01')).toBe(5.4);
  });

  it('độ lệch = sim − mốc (heat rate %, còn lại tuyệt đối)', () => {
    const r = step({
      PLANT_UNIT_HR_NET_01: 11040, // +20% so 9200
      PLANT_NET_EFF_01: 33,
      CT_CW_SUPPLY_01: 31,
      PLANT_ENERGY_CLOSURE_01: 100,
      BLR_MSTM_SH_TEMP_01: 541,
      TRB_HRH_TEMP_01: 541,
      BLR_MSTM_SH_PRESS_01: 17.5,
      TRB_COND_VACUUM_01: 5.4,
    });
    expect(v(r, 'PLANT_CAL_HR_DEV_01')).toBeCloseTo(20, 5); // (11040−9200)/9200·100
    expect(v(r, 'PLANT_CAL_EFF_DEV_01')).toBeCloseTo(-6, 5); // 33 − 39
    expect(v(r, 'PLANT_CAL_CW_DEV_01')).toBeCloseTo(12, 5); // 31 − 19 (nhiệt đới)
    expect(v(r, 'PLANT_CAL_CLOSURE_DEV_01')).toBeCloseTo(0, 5); // khép NL đạt
    // Điều kiện hơi ĐƯỢC ĐIỀU KHIỂN ở đúng điểm thiết kế → độ lệch 0 (khu biệt gap không do điều kiện hơi).
    expect(v(r, 'PLANT_CAL_MST_DEV_01')).toBeCloseTo(0, 5);
    expect(v(r, 'PLANT_CAL_HRH_DEV_01')).toBeCloseTo(0, 5);
    expect(v(r, 'PLANT_CAL_MSP_DEV_01')).toBeCloseTo(0, 5);
    expect(v(r, 'PLANT_CAL_VAC_DEV_01')).toBeCloseTo(0, 5);
  });

  it('heat rate không xác định (0) → độ lệch HR = 0 (không chia cho 0 giả)', () => {
    expect(v(step({ PLANT_UNIT_HR_NET_01: 0 }), 'PLANT_CAL_HR_DEV_01')).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';

describe('thermal-runtime — tháp làm mát khép vòng CW sống trong vòng CCS (v1.24)', () => {
  it('cooling tower khép vòng: nhiệt thải = duty bình ngưng, bốc hơi > 0, CW cấp từ bầu ướt', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 500; i++) rt.step();

    // Nhiệt thải tháp = nhiệt thải bình ngưng (khép vòng nhất quán).
    expect(rt.value('CT_HEAT_REJECT_01')).toBeCloseTo(rt.value('COND_DUTY_01'), 3);
    expect(rt.value('CT_EVAP_LOSS_01')).toBeGreaterThan(400); // t/h bốc hơi
    expect(rt.value('CT_MAKEUP_01')).toBeGreaterThan(rt.value('CT_EVAP_LOSS_01')); // bổ sung > bốc hơi
    expect(rt.value('CT_CW_SUPPLY_01')).toBeCloseTo(31, 0); // bầu ướt 27 + approach 4
    expect(rt.value('CT_RANGE_01')).toBeCloseTo(rt.value('COND_CW_RISE_01'), 3);
  });
});

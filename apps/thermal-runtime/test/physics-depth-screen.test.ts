import { describe, it, expect } from 'vitest';
import { createThermalRuntime } from '../src/runtime';
import { boilerScreens, screenTags, thermalNav } from '@idtp/plugin-thermal-power-600';

// Màn tổng hợp D2-physics-depth: gom chỉ số các hệ chiều sâu (AVR/ANSI/drain/regen/fouling/CEMS).
// Kiểm màn + nav có mặt và MỌI tag tham chiếu đều SỐNG trong runtime (không ô rỗng).
describe('thermal-runtime — màn tổng hợp chiều sâu physics (D2)', () => {
  it('D2-physics-depth có trong screens + nav; mọi tag của màn có giá trị sống', () => {
    const scr = boilerScreens.find((s) => s.screenId === 'D2-physics-depth');
    expect(scr).toBeDefined();
    expect(thermalNav.some((n) => n.screenId === 'D2-physics-depth')).toBe(true);
    if (!scr) return;

    const rt = createThermalRuntime();
    for (let i = 0; i < 600; i++) rt.step();

    const tags = screenTags(scr);
    expect(tags.length).toBeGreaterThanOrEqual(30); // v1.64: mở rộng thêm TSE/CNDP/GCAP (21→30 ô)
    for (const t of tags) {
      const v = rt.value(t);
      expect(Number.isFinite(v), `tag ${t} phải sống`).toBe(true);
    }
    // Nhất quán vài chỉ số cốt lõi ở điểm vận hành.
    expect(rt.value('ANSI_PROT_HEALTHY_01')).toBe(1);
    expect(rt.value('FA_FOULING_HEALTHY_01')).toBe(1);
    expect(rt.value('ELEC_TERM_VOLT_01')).toBeCloseTo(20, 0);
  });
});

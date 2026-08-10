import { describe, it, expect } from 'vitest';
import { thermalAssetHealth } from '@idtp/plugin-thermal-power-600';
import { createThermalRuntime } from '../src/runtime';

// P2 — mọi tag tín hiệu sức khoẻ PHẢI tồn tại trong runtime (có mặt trong recordedTags = tag được model
// sinh + ghi historian). Đồng thời điểm vận hành sạch → mọi tag hữu hạn (không NaN).
describe('P2 — tag sức khoẻ tài sản tồn tại & sống trong runtime', () => {
  it('mọi tag ∈ recordedTags và hữu hạn sau khi chạy', () => {
    const rt = createThermalRuntime();
    for (let i = 0; i < 300; i++) rt.step();
    const recorded = new Set(rt.recordedTags());
    for (const a of thermalAssetHealth) {
      for (const s of a.signals) {
        expect(recorded.has(s.tag), `${a.assetId}: ${s.tag} không có trong recordedTags`).toBe(true);
        expect(Number.isFinite(rt.value(s.tag)), `${a.assetId}: ${s.tag} không hữu hạn`).toBe(true);
      }
      if (a.runTag) expect(recorded.has(a.runTag), `${a.assetId}: runTag ${a.runTag}`).toBe(true);
    }
  });
});

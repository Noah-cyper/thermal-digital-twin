import { describe, it, expect } from 'vitest';
import { thermalFaceplates, boilerControlLoops } from '@idtp/plugin-thermal-power-600';

describe('HMI polish (v1.41): faceplate phủ đủ 25 vòng điều khiển', () => {
  it('mọi tag PV của vòng đều có faceplate; assetId & pvTag của faceplate duy nhất (click-map sạch)', () => {
    const fpPvTags = new Set(thermalFaceplates.map((f) => f.pvTag));
    for (const l of boilerControlLoops) {
      expect(fpPvTags.has(l.pvTag)).toBe(true); // mọi PV vòng đều mở được faceplate (kể cả PV dùng chung)
    }
    // Khử trùng theo pvTag → mỗi faceplate có assetId + pvTag duy nhất → client map pvTag→assetId sạch.
    expect(new Set(thermalFaceplates.map((f) => f.assetId)).size).toBe(thermalFaceplates.length);
    expect(new Set(thermalFaceplates.map((f) => f.pvTag)).size).toBe(thermalFaceplates.length);
    expect(thermalFaceplates.length).toBeGreaterThanOrEqual(25); // ≥ 25 (một faceplate cho mỗi PV vòng duy nhất)
  });

  it('mỗi faceplate có PV + OP + (SP tĩnh hoặc spTag) + tiêu đề tiếng Việt', () => {
    for (const f of thermalFaceplates) {
      expect(typeof f.pvTag).toBe('string');
      expect(typeof f.opTag).toBe('string');
      expect(f.sp !== undefined || f.spTag !== undefined).toBe(true);
      expect(f.title.vi.length).toBeGreaterThan(0);
    }
  });
});

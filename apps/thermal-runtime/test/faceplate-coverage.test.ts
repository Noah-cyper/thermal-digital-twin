import { describe, it, expect } from 'vitest';
import { thermalFaceplates, boilerControlLoops } from '@idtp/plugin-thermal-power-600';

describe('HMI polish (v1.41): faceplate phủ đủ 25 vòng điều khiển', () => {
  it('mỗi vòng có đúng 1 faceplate; 25 faceplate; assetId & pvTag duy nhất', () => {
    expect(thermalFaceplates.length).toBe(boilerControlLoops.length); // 25 = 25

    const fpLoopIds = new Set(thermalFaceplates.map((f) => f.loopId));
    for (const l of boilerControlLoops) {
      expect(fpLoopIds.has(l.id)).toBe(true); // mọi vòng đều có faceplate
    }
    expect(new Set(thermalFaceplates.map((f) => f.assetId)).size).toBe(thermalFaceplates.length);
    expect(new Set(thermalFaceplates.map((f) => f.pvTag)).size).toBe(thermalFaceplates.length); // pvTag duy nhất → click-map sạch
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

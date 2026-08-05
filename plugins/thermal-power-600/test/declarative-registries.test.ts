import { describe, it, expect } from 'vitest';
import {
  boilerScreens,
  screenTags,
  boilerControlLoops,
  boilerLoopSeeds,
  thermalNav,
  thermalFaceplates,
  thermalInterlocks,
  thermalKpis,
  thermalMaintenance,
} from '../src/index';

describe('registry khai báo plugin thermal-power-600 — bất biến cấu trúc + tham chiếu chéo', () => {
  it('màn hình: mỗi screen có id/level/title/elements; screenTags trả tag; ≥ 24 màn', () => {
    expect(boilerScreens.length).toBeGreaterThanOrEqual(24);
    const ids = new Set<string>();
    for (const s of boilerScreens) {
      expect(typeof s.screenId).toBe('string');
      expect(['D1', 'D2', 'D3', 'D4']).toContain(s.level);
      expect(s.title.vi.length).toBeGreaterThan(0);
      expect(Array.isArray(s.elements)).toBe(true);
      expect(ids.has(s.screenId)).toBe(false); // screenId duy nhất
      ids.add(s.screenId);
      expect(Array.isArray(screenTags(s))).toBe(true);
    }
  });

  it('vòng điều khiển: id duy nhất; mỗi vòng có pvTag + outTag + (sp hoặc spTag); seed hợp lệ', () => {
    const ids = new Set<string>();
    for (const l of boilerControlLoops) {
      expect(ids.has(l.id)).toBe(false);
      ids.add(l.id);
      expect(typeof l.pvTag).toBe('string');
      expect(typeof l.outTag).toBe('string');
      expect(l.sp !== undefined || l.spTag !== undefined).toBe(true);
      expect(l.outHi).toBeGreaterThan(l.outLo);
    }
    // seed nào có cũng ứng với 1 vòng thật.
    for (const k of Object.keys(boilerLoopSeeds)) expect(ids.has(k)).toBe(true);
  });

  it('cây điều hướng: mọi node trỏ tới screen tồn tại; parentId (nếu có) cũng tồn tại', () => {
    const screenIds = new Set(boilerScreens.map((s) => s.screenId));
    for (const n of thermalNav) {
      expect(screenIds.has(n.screenId)).toBe(true);
      if (n.parentId !== undefined) expect(screenIds.has(n.parentId)).toBe(true);
    }
  });

  it('faceplate: assetId + pvTag duy nhất (click-map sạch); phủ mọi PV vòng', () => {
    expect(new Set(thermalFaceplates.map((f) => f.assetId)).size).toBe(thermalFaceplates.length);
    const fpPv = new Set(thermalFaceplates.map((f) => f.pvTag));
    expect(new Set(thermalFaceplates.map((f) => f.pvTag)).size).toBe(thermalFaceplates.length);
    for (const l of boilerControlLoops) expect(fpPv.has(l.pvTag)).toBe(true);
  });

  it('interlock + KPI + maintenance: danh mục khai báo không rỗng, có định danh', () => {
    expect(thermalInterlocks.length).toBeGreaterThan(0);
    for (const il of thermalInterlocks) expect(typeof il.id).toBe('string');
    expect(thermalKpis.length).toBeGreaterThan(0);
    expect(thermalMaintenance.length).toBeGreaterThan(0);
  });
});

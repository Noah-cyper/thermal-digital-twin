import { describe, it, expect } from 'vitest';
import type { AssetKind } from '@idtp/sdk';
import { thermalAssetHealth } from '../src/index';

const VALID_KINDS: ReadonlyArray<AssetKind> = ['pump', 'fan', 'mill', 'turbine-generator', 'compressor', 'heat-exchanger', 'tank', 'valve', 'transformer', 'other'];

describe('P2 — sổ đăng ký sức khoẻ tài sản (thermalAssetHealth)', () => {
  it('bộ ~12–16 tài sản, assetId duy nhất, kind hợp lệ', () => {
    expect(thermalAssetHealth.length).toBeGreaterThanOrEqual(12);
    expect(thermalAssetHealth.length).toBeLessThanOrEqual(16);
    const ids = thermalAssetHealth.map((a) => a.assetId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of thermalAssetHealth) expect(VALID_KINDS).toContain(a.kind);
  });

  it('mỗi tài sản ≥1 tín hiệu; good≠bad; weight>0; nhãn vi+en', () => {
    for (const a of thermalAssetHealth) {
      expect(a.signals.length, a.assetId).toBeGreaterThanOrEqual(1);
      expect(a.name.vi.length, a.assetId).toBeGreaterThan(0);
      expect(a.name.en.length, a.assetId).toBeGreaterThan(0);
      for (const s of a.signals) {
        expect(s.good, `${a.assetId}/${s.tag}`).not.toBe(s.bad);
        expect(s.weight, `${a.assetId}/${s.tag}`).toBeGreaterThan(0);
        expect(s.label.vi.length).toBeGreaterThan(0);
        expect(s.tag.length).toBeGreaterThan(0);
      }
    }
  });

  it('tag tín hiệu duy nhất trong từng tài sản (không trùng)', () => {
    for (const a of thermalAssetHealth) {
      const tags = a.signals.map((s) => s.tag);
      expect(new Set(tags).size, a.assetId).toBe(tags.length);
    }
  });
});

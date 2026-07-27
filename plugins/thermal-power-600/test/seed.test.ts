import { describe, it, expect } from 'vitest';
import { generateRegistry } from '@idtp/engines';
import { thermalSeedSpec } from '../src/seed/spec';

// BÀI CHỨNG MINH QUY MÔ §10: spec khai báo của plugin, khi expand bằng engine GENERIC, đạt
// ≥ 3.000 tag / ≥ 600 alarm (nghiệm thu doc 00 §10, roll-up doc 07 §4 / doc 08 §4) — 0 dòng kernel.
const reg = generateRegistry(thermalSeedSpec);

const UNS_RE = /^[a-z0-9-]+(\/[a-z0-9-]+){6}$/;
const NAME_RE = /^[A-Z0-9_]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('thermal seed registry (doc 07 §4 / doc 08 §4) — quy mô §10', () => {
  it('roll-up: ≥ 3.000 tag · ≥ 600 alarm', () => {
    // eslint-disable-next-line no-console
    console.log(
      `[seed] tags=${reg.tags.length} alarms=${reg.alarms.length} byScan=${JSON.stringify(reg.byScanClass)} byCell=${JSON.stringify(reg.byCell)}`,
    );
    expect(reg.tags.length).toBeGreaterThanOrEqual(3000);
    expect(reg.alarms.length).toBeGreaterThanOrEqual(600);
  });

  it('roll-up theo khu vực khớp thiết kế (doc 07 §4)', () => {
    expect(reg.byCell['boiler']).toBe(600); // 6 mill·6 fan·140 xmtr·6 loop
    expect(reg.byCell['generator']).toBe(176);
    expect(reg.byCell['cw']).toBe(90);
    expect(reg.byCell['system']).toBe(200); // calc/derived
  });

  it('tính toàn vẹn: name/UNS/UUID hợp lệ, name & id DUY NHẤT, KKS không rỗng', () => {
    const names = new Set<string>();
    const ids = new Set<string>();
    for (const t of reg.tags) {
      expect(t.name).toMatch(NAME_RE);
      expect(t.uns).toMatch(UNS_RE);
      expect(t.id).toMatch(UUID_RE);
      expect(t.kks.length).toBeGreaterThan(0);
      names.add(t.name);
      ids.add(t.id);
    }
    expect(names.size).toBe(reg.tags.length);
    expect(ids.size).toBe(reg.tags.length); // không đụng UUID
  });

  it('alarm trỏ tới tag tồn tại; có alarm bảo vệ tiêu biểu (mill trip, breaker prot)', () => {
    const names = new Set(reg.tags.map((t) => t.name));
    for (const a of reg.alarms) expect(names.has(a.tagId)).toBe(true);
    expect(reg.alarms.some((a) => a.alarmId === 'BLR_MILL_01_TRIP-DISCRETE')).toBe(true);
    expect(reg.alarms.some((a) => a.alarmId === 'ELE_CB_01_PROT-DISCRETE')).toBe(true);
    // tag writable (loop SP/OP) có securityLevel ≥ 1; đo lường chỉ đọc = 0
    const sp = reg.tags.find((t) => t.name === 'BLR_LOOP_01_SP');
    expect(sp?.isWritable).toBe(true);
    expect((sp?.securityLevel ?? 0)).toBeGreaterThanOrEqual(1);
  });
});

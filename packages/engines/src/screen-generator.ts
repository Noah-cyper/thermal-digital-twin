// @idtp/engines — ScreenGenerator (doc 12/13). Sinh bộ màn hình KHAI BÁO (ScreenDef[]) từ registry
// + nhóm instance của plugin: D2 tổng quan/cell · D3 chi tiết/nhóm thiết bị · D4 chẩn đoán/cell.
// GENERIC: không hiểu biết plant; đạt quy mô §10 (≥ 70 màn hình) = thêm DỮ LIỆU, 0 dòng sửa kernel.
// Là DANH MỤC (catalog) — kernel render bằng binding, không hardcode màn hình process.
import type { InstanceGroup, ScreenDef, ScreenElement, SeededRegistry, TagRecord } from '@idtp/sdk';

const COL = 168;
const ROW = 100;
const X0 = 24;
const Y0 = 24;
const TILE_W = 150;
const TILE_H = 78;
const COLS = 4; // số cột lưới
const MAX_TILE = 12; // trần ô/màn hình (giữ màn hình gọn)

function tile(id: string, t: TagRecord, label: string, idx: number): ScreenElement {
  const col = idx % COLS;
  const row = Math.floor(idx / COLS);
  return {
    id,
    symbol: 'value',
    x: X0 + col * COL,
    y: Y0 + row * ROW,
    w: TILE_W,
    h: TILE_H,
    label,
    unit: t.eu,
    bindings: [
      { property: 'text', tag: t.name, transform: { kind: 'linear', scale: 1 } },
      { property: 'fill', tag: t.name, condition: { when: 'bad', then: { fill: 'var(--bad-quality)' } } },
    ],
  };
}

/** Tag đại diện: ưu tiên float (đo lường), fallback tag đầu. */
function rep(tags: ReadonlyArray<TagRecord>): TagRecord | undefined {
  return tags.find((t) => t.datatype === 'float') ?? tags[0];
}
/** Tag chẩn đoán: ưu tiên tag có alarm, fallback float. */
function repAlarm(tags: ReadonlyArray<TagRecord>): TagRecord | undefined {
  return tags.find((t) => t.alarmIds.length > 0) ?? rep(tags);
}

/**
 * Sinh màn hình từ registry + nhóm instance. Mỗi nhóm → 1 D3; mỗi cell → 1 D2 + 1 D4.
 * Tất định (theo thứ tự nhóm/tag); ném lỗi khi trùng screenId.
 */
export function generateScreens(
  registry: SeededRegistry,
  groups: ReadonlyArray<InstanceGroup>,
): ScreenDef[] {
  const screens: ScreenDef[] = [];
  const ids = new Set<string>();
  const push = (s: ScreenDef): void => {
    if (ids.has(s.screenId)) throw new Error(`ScreenGenerator: trùng screenId '${s.screenId}'`);
    ids.add(s.screenId);
    screens.push(s);
  };
  const slug = (s: string): string => s.toLowerCase().replace(/_/g, '-');

  // Index tag theo nhóm (namePrefix) và theo instance (nn).
  const tagsOfGroup = new Map<string, TagRecord[]>();
  for (const g of groups) tagsOfGroup.set(g.namePrefix, []);
  for (const t of registry.tags) {
    for (const g of groups) {
      if (t.name.startsWith(`${g.namePrefix}_`)) {
        tagsOfGroup.get(g.namePrefix)?.push(t);
        break;
      }
    }
  }
  const instOf = (g: InstanceGroup, nn: string): TagRecord[] =>
    (tagsOfGroup.get(g.namePrefix) ?? []).filter((t) => t.name.startsWith(`${g.namePrefix}_${nn}_`));

  // D3 mỗi nhóm — chi tiết instance (1 ô đại diện/instance, trần MAX_TILE).
  for (const g of groups) {
    const elements: ScreenElement[] = [];
    const n = Math.min(g.count, MAX_TILE);
    for (let i = 1; i <= n; i++) {
      const nn = String(i).padStart(2, '0');
      const r = rep(instOf(g, nn));
      if (r) elements.push(tile(`i${nn}`, r, `${g.equip.toUpperCase()}-${nn}`, i - 1));
    }
    if (elements.length > 0)
      push({ screenId: `D3-${slug(g.namePrefix)}`, level: 'D3', title: { vi: g.descVi, en: g.descEn }, elements });
  }

  // Cell → D2 (tổng quan: 1 ô/nhóm, instance 01) + D4 (chẩn đoán: ô alarm/nhóm).
  const cells = [...new Set(groups.map((g) => g.cell))];
  for (const cell of cells) {
    const cellGroups = groups.filter((g) => g.cell === cell);
    const d2: ScreenElement[] = [];
    const d4: ScreenElement[] = [];
    let i = 0;
    for (const g of cellGroups) {
      const inst01 = instOf(g, '01');
      const r2 = rep(inst01);
      const r4 = repAlarm(inst01);
      if (r2) d2.push(tile(`g${i}`, r2, g.descVi, i));
      if (r4) d4.push(tile(`g${i}`, r4, g.descVi, i));
      i++;
    }
    if (d2.length > 0)
      push({ screenId: `D2-${cell}`, level: 'D2', title: { vi: `Khu vực ${cell}`, en: `Area ${cell}` }, elements: d2 });
    if (d4.length > 0)
      push({ screenId: `D4-${cell}`, level: 'D4', title: { vi: `Chẩn đoán ${cell}`, en: `Diagnostics ${cell}` }, elements: d4 });
  }

  return screens;
}

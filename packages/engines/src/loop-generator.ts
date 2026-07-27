// @idtp/engines — LoopGenerator (doc 09). Sinh ControlLoopDef breadth từ registry: một loop cho MỖI
// instance có ĐỦ cặp tag `_PV` + `_OP` (van/PID điều khiển). GENERIC theo cấu trúc tag — không cần
// biết tên template của plugin; đạt §10 (≥ 25 loop) = thêm DỮ LIỆU. Là DANH MỤC: mode khởi tạo MAN,
// tuning mặc định [GIẢ ĐỊNH] (GĐ-44) — vòng CCS lõi Boiler Island vẫn dùng 7 loop đã tinh chỉnh.
import type { ControlLoopDef, SeededRegistry, TagRecord } from '@idtp/sdk';

interface InstTags {
  readonly key: string; // prefix + nn, vd BLR_LOOP_01
  pv?: TagRecord;
  op?: TagRecord;
}

/** Tách (key = prefix+nn, suffix) từ fallback name AREA_SYS_..._NN_SUFFIX (NN = số ≥ 2 chữ số). */
function splitName(name: string): { key: string; suffix: string } | null {
  const parts = name.split('_');
  const idx = parts.findIndex((p) => /^\d{2,}$/.test(p));
  if (idx < 0 || idx === parts.length - 1) return null;
  return { key: parts.slice(0, idx + 1).join('_'), suffix: parts.slice(idx + 1).join('_') };
}

/**
 * Sinh ControlLoopDef cho mỗi instance có cả `_PV` và `_OP`. Tất định (theo thứ tự tag trong
 * registry). SP = trung điểm dải PV; tuning mặc định; outLo/outHi từ dải tag OP.
 */
export function generateControlLoops(registry: SeededRegistry): ControlLoopDef[] {
  const byInst = new Map<string, InstTags>();
  const order: string[] = [];
  for (const t of registry.tags) {
    const s = splitName(t.name);
    if (!s) continue;
    if (s.suffix !== 'PV' && s.suffix !== 'OP') continue;
    let e = byInst.get(s.key);
    if (!e) {
      e = { key: s.key };
      byInst.set(s.key, e);
      order.push(s.key);
    }
    if (s.suffix === 'PV') e.pv = t;
    else e.op = t;
  }

  const loops: ControlLoopDef[] = [];
  for (const key of order) {
    const e = byInst.get(key);
    if (!e || !e.pv || !e.op) continue;
    loops.push({
      id: key,
      desc: e.pv.descVi,
      pvTag: e.pv.name,
      sp: (e.pv.rangeLo + e.pv.rangeHi) / 2,
      kp: 1,
      ki: 0.1,
      kd: 0,
      outLo: e.op.rangeLo,
      outHi: e.op.rangeHi,
      mode: 'MAN',
      outTag: e.op.name,
    });
  }
  return loops;
}

// L5 — Screen Builder (doc 05-02, Engineering). Người KHÔNG code chỉ liệt kê tag + nhãn (ScreenBuildSpec);
// engine tự DÀN LƯỚI + sinh binding → ScreenDef hợp lệ để kernel render. Không phải kéo-thả (UI đó là
// pha sau) nhưng bỏ hoàn toàn việc gõ toạ độ/binding tay — đúng tinh thần "màn hình = dữ liệu khai báo".
import type { Binding, ScreenBuildSpec, ScreenDef, ScreenElement } from '@idtp/sdk';

const COL = 168;
const ROW = 100;
const X0 = 24;
const Y0 = 24;
const TILE_W = 150;
const TILE_H = 78;

function valueTile(id: string, t: { tag: string; label?: string; unit?: string; alarms?: ReadonlyArray<{ when: 'gt' | 'lt'; value: number; sev: 1 | 2 | 3 }> }, x: number, y: number): ScreenElement {
  const bindings: Binding[] = [{ property: 'text', tag: t.tag, transform: { kind: 'linear', scale: 1 } }];
  for (const a of t.alarms ?? []) bindings.push({ property: 'fill', tag: t.tag, condition: { when: a.when, value: a.value, then: { fill: `var(--alarm-${a.sev})` } } });
  bindings.push({ property: 'fill', tag: t.tag, condition: { when: 'bad', then: { fill: 'var(--bad-quality)' } } });
  return { id, symbol: 'value', x, y, w: TILE_W, h: TILE_H, ...(t.label !== undefined ? { label: t.label } : {}), ...(t.unit !== undefined ? { unit: t.unit } : {}), bindings };
}
function barTile(id: string, t: { tag: string; label?: string; barScale?: number }, x: number, y: number): ScreenElement {
  return { id, symbol: 'bar', x, y, w: TILE_W, h: TILE_H, ...(t.label !== undefined ? { label: t.label } : {}), unit: '%', bindings: [{ property: 'value', tag: t.tag, transform: { kind: 'linear', scale: t.barScale ?? 1 } }] };
}

/** Dựng ScreenDef từ spec đơn giản. Ném lỗi nếu spec không hợp lệ (screenId rỗng / không có tile). */
export function buildScreen(spec: ScreenBuildSpec): ScreenDef {
  if (!spec.screenId || spec.screenId.trim() === '') throw new Error('ScreenBuilder: screenId rỗng');
  if (spec.tiles.length === 0) throw new Error('ScreenBuilder: cần ít nhất 1 tile');
  const cols = Math.max(1, spec.cols ?? 4);
  const elements: ScreenElement[] = spec.tiles.map((t, i) => {
    const x = X0 + (i % cols) * COL;
    const y = Y0 + Math.floor(i / cols) * ROW;
    const id = `t${i}`;
    return (t.kind ?? 'value') === 'bar' ? barTile(id, t, x, y) : valueTile(id, t, x, y);
  });
  return { screenId: spec.screenId, level: spec.level, ...(spec.title ? { title: spec.title } : {}), elements };
}

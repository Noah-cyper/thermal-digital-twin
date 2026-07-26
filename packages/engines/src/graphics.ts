// L2 — Graphics Runtime binding evaluator (doc 05-02). Thuần, kiểm thử được; áp binding khai báo
// {property, tag, transform, condition} lên giá trị tag → props phần tử. Cấm hardcode màn hình.
// Kiểu màn hình khai báo nằm ở @idtp/sdk (plugin cung cấp screen dạng data); re-export để tương thích.
import type { Quality, TransformSpec, ConditionSpec, ScreenElement, ScreenDef } from '@idtp/sdk';

export type { ScreenLevel, TransformSpec, ConditionSpec, Binding, ScreenElement, ScreenDef } from '@idtp/sdk';

export interface TagRead {
  value: number | boolean | string;
  quality: Quality;
}

export function evalTransform(value: number | boolean | string, t: TransformSpec): string {
  if (t.kind === 'linear' && typeof value === 'number') {
    return String(value * (t.scale ?? 1) + (t.offset ?? 0));
  }
  if (t.kind === 'map') return t.map?.[String(value)] ?? String(value);
  return String(value);
}

export function evalCondition(read: TagRead, c: ConditionSpec): boolean {
  if (c.when === 'bad') return read.quality === 'Bad' || read.quality === 'Uncertain';
  if (typeof read.value !== 'number' || c.value === undefined) return false;
  if (c.when === 'gt') return read.value > c.value;
  if (c.when === 'lt') return read.value < c.value;
  return read.value === c.value;
}

export function applyElement(el: ScreenElement, reads: ReadonlyMap<string, TagRead>): Record<string, string> {
  const props: Record<string, string> = {};
  for (const b of el.bindings) {
    const read = reads.get(b.tag);
    if (!read) continue;
    if (b.transform) {
      props[b.property] = evalTransform(read.value, b.transform);
    } else if (b.condition && evalCondition(read, b.condition)) {
      Object.assign(props, b.condition.then);
    }
  }
  return props;
}

export function applyScreen(def: ScreenDef, reads: ReadonlyMap<string, TagRead>): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>();
  for (const el of def.elements) out.set(el.id, applyElement(el, reads));
  return out;
}

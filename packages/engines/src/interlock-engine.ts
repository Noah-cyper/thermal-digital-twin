// @idtp/engines — InterlockEngine (W6 DoD: interlock/permissive first-class, lệnh bị chặn HIỆN LÝ DO).
// Đánh giá luật interlock KHAI BÁO của plugin theo giá trị tag hiện tại; trả về interlock đang chặn một
// TARGET (lệnh/loop/thiết bị) kèm lý do. GENERIC: không hiểu biết plant. READ-ONLY — chỉ ĐỌC tag để
// quyết định cho phép; không ghi gì. Server gọi trước khi cho lệnh ra thiết bị đi tiếp.
import type { InterlockRule, InterlockCondition, InterlockCheck } from '@idtp/sdk';

function condTrue(c: InterlockCondition, v: number): boolean {
  switch (c.op) {
    case 'gt': return v > c.value;
    case 'lt': return v < c.value;
    case 'ge': return v >= c.value;
    case 'le': return v <= c.value;
    case 'eq': return v === c.value;
    case 'ne': return v !== c.value;
  }
}

export class InterlockEngine {
  private readonly byTarget = new Map<string, InterlockRule[]>();

  constructor(private readonly rules: ReadonlyArray<InterlockRule>) {
    for (const r of rules) {
      const list = this.byTarget.get(r.target);
      if (list) list.push(r);
      else this.byTarget.set(r.target, [r]);
    }
  }

  /** Một luật ĐANG HOẠT ĐỘNG khi TẤT CẢ điều kiện `when` đều đúng theo giá trị tag hiện tại. */
  private ruleActive(r: InterlockRule, getTag: (tagId: string) => number): boolean {
    return r.when.length > 0 && r.when.every((c) => condTrue(c, getTag(c.tag)));
  }

  /** Kiểm tra một target: có interlock nào đang chặn không + lý do (lang 'vi' mặc định). */
  check(target: string, getTag: (tagId: string) => number, lang: 'vi' | 'en' = 'vi'): InterlockCheck {
    const reasons: string[] = [];
    const ids: string[] = [];
    for (const r of this.byTarget.get(target) ?? []) {
      if (this.ruleActive(r, getTag)) {
        reasons.push(r.message[lang]);
        ids.push(r.id);
      }
    }
    return { blocked: ids.length > 0, reasons, ids };
  }

  /** Toàn bộ interlock đang hoạt động (cho bảng permissive/panel giám sát). */
  active(getTag: (tagId: string) => number, lang: 'vi' | 'en' = 'vi'): Array<{ id: string; target: string; message: string }> {
    const out: Array<{ id: string; target: string; message: string }> = [];
    for (const r of this.rules) if (this.ruleActive(r, getTag)) out.push({ id: r.id, target: r.target, message: r.message[lang] });
    return out;
  }

  targets(): ReadonlyArray<string> {
    return [...this.byTarget.keys()];
  }
}

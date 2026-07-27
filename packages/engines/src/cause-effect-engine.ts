// @idtp/engines — CauseEffectEngine (doc 09 §4, ISA C&E / NFPA 85). Đánh giá ma trận CAUSE & EFFECT
// KHAI BÁO: nguyên nhân đúng → hệ quả CHỐT (latch) → ghi lệnh trip (audit) một lần. GENERIC: không
// hiểu biết plant. Trip latch tới khi reset() (chỉ reset được khi nguyên nhân đã hết — an toàn).
import type { CauseEffectMatrix, CeCause, CeState, IWriteCommand } from '@idtp/sdk';

function num(v: number | boolean): number {
  return typeof v === 'boolean' ? (v ? 1 : 0) : v;
}
function causeActive(c: CeCause, v: number): boolean {
  switch (c.op) {
    case 'gt': return v > c.value;
    case 'lt': return v < c.value;
    case 'ge': return v >= c.value;
    case 'le': return v <= c.value;
  }
}

export interface CauseEffectIo {
  command?(cmd: IWriteCommand): void; // ghi hệ quả (audit) — tuỳ chọn
}

export class CauseEffectEngine {
  private readonly tripped = new Set<string>();
  private active: string[] = [];

  constructor(
    private readonly def: CauseEffectMatrix,
    private readonly io: CauseEffectIo = {},
  ) {}

  /** Đánh giá theo giá trị tag hiện tại; chốt hệ quả mới & ghi lệnh trip một lần. */
  evaluate(getTag: (tagId: string) => number | boolean): CeState {
    const active = new Set<string>();
    for (const c of this.def.causes) if (causeActive(c, num(getTag(c.tag)))) active.add(c.id);
    this.active = [...active];

    for (const cell of this.def.cells) {
      if (!active.has(cell.cause) || this.tripped.has(cell.effect)) continue;
      const eff = this.def.effects.find((e) => e.id === cell.effect);
      if (!eff) continue;
      this.tripped.add(eff.id);
      this.io.command?.({ tagId: eff.tag, value: eff.value, user: 'cause-effect', reason: `${this.def.matrixId}: ${cell.cause} → ${eff.id}` });
    }
    return this.state();
  }

  /** Reset trip đã chốt — chỉ cho phép khi KHÔNG còn nguyên nhân active (an toàn). */
  reset(): boolean {
    if (this.active.length > 0) return false;
    this.tripped.clear();
    return true;
  }

  state(): CeState {
    return { activeCauses: [...this.active], trippedEffects: [...this.tripped] };
  }

  get matrixId(): string {
    return this.def.matrixId;
  }
}

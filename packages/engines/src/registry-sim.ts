// L2 — RegistrySimModel (doc 05-05). Làm CẢ §10 catalog "SỐNG": sinh giá trị hợp lý theo thời gian
// cho MỌI tag breadth (3.6k) chưa có mô hình vật lý riêng → cả nhà máy "thở", mọi màn hình có dữ liệu.
// Không phải physics thật — là DỮ LIỆU PLACEHOLDER cho OTS/demo ([GIẢ ĐỊNH], GĐ-61): analog ~ 40% dải
// + nhiễu LCG có seed (KHÔNG Math.random), bool/int = 0 (bình thường) → không kích alarm breadth (ở
// biên dải). Chạy stride (mặc định mỗi 10 bước) để chi phí ingest nhỏ. Tag đã có sim thật (boiler/
// turbine) tách biệt — không đụng.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId, TagRecord } from '@idtp/sdk';

const SEED = 0x2545f491;
const FRAC = 0.4; // vị trí trong dải (0..1) — thấp-vừa, "calm"
const NOISE_FRAC = 0.02; // biên nhiễu = 2% dải

class Lcg {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  sym(amp: number): number {
    this.s = (Math.imul(this.s, 1_664_525) + 1_013_904_223) >>> 0;
    return (this.s / 0x1_0000_0000 - 0.5) * 2 * amp;
  }
  get state(): number {
    return this.s;
  }
  set state(v: number) {
    this.s = v >>> 0;
  }
}

interface Spec {
  name: string;
  base: number;
  amp: number;
}

export class RegistrySimModel implements ISimModel {
  readonly id = 'registry-breadth';
  readonly tagsProvided: ReadonlyArray<TagId>;
  private readonly specs: Spec[] = [];
  private rng = new Lcg(SEED);
  private tick = 0;

  constructor(
    tags: ReadonlyArray<TagRecord>,
    private readonly stride = 10,
  ) {
    for (const t of tags) {
      if (t.datatype === 'string') continue;
      if (t.datatype === 'float') {
        const span = t.rangeHi - t.rangeLo;
        this.specs.push({ name: t.name, base: t.rangeLo + FRAC * span, amp: Math.max(0, span * NOISE_FRAC) });
      } else {
        this.specs.push({ name: t.name, base: 0, amp: 0 }); // bool/int = 0 (bình thường)
      }
    }
    this.tagsProvided = this.specs.map((s) => s.name);
  }

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.rng = new Lcg(SEED);
    this.tick = 0;
  }

  step(_ctx: ISimModelContext): ISimStepResult {
    if (this.tick++ % this.stride !== 0) return { outputs: [] }; // stride: cập nhật thưa để nhẹ ingest
    return {
      outputs: this.specs.map((s) => ({ tagId: s.name, value: s.amp > 0 ? s.base + this.rng.sym(s.amp) : s.base, quality: 'Good' as const })),
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { rng: this.rng.state, tick: this.tick } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.rng.state = snapshot.state.rng ?? SEED;
    this.tick = snapshot.state.tick ?? 0;
  }
  injectMalfunction(_m: IMalfunction): void {
    // breadth placeholder không có malfunction
  }
  clearMalfunction(_id: string): void {
    // no-op
  }
  dispose(): void {
    // no-op
  }
}

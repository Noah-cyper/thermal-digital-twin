// Plugin water-treatment-demo — WaterTankModel (ISimModel). CHỈ import @idtp/sdk (luật L-P1).
// Bể nước DM: cân bằng khối lượng level = ∫(feed − out); feed từ bơm qua van điều khiển; out = nhu cầu.
// Nhiễu đo seeded (không Math.random). Malfunction: pump-a-trip, tank-leak. Số liệu demo [GIẢ ĐỊNH].
import type { ISimModel, ISimModelContext, ISimStepResult, ISimSnapshot, IMalfunction, TagId } from '@idtp/sdk';

const FEED_MAX = 200; // m³/h — công suất bơm cấp
const TANK_VOL = 60; // m³ — dung tích bể (surge tank demo)
const SEED = 0x1234abcd;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

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

export class WaterTankModel implements ISimModel {
  readonly id = 'water-dm-tank';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'WTP_TANK_LEVEL_01', // %
    'WTP_FEED_FLOW_01', // m³/h
    'WTP_OUT_FLOW_01', // m³/h
    'WTP_PUMP_A_RUN', // 0/1
  ];

  private level = 40; // %
  private pumpATripped = false;
  private leak = 0; // m³/h
  private rng = new Lcg(SEED);

  init(): void {
    this.level = 40;
    this.pumpATripped = false;
    this.leak = 0;
    this.rng = new Lcg(SEED);
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const cv = clamp(ctx.getTag('WTP_FEED_CV_01'), 0, 100); // % van cấp
    const demand = Math.max(0, ctx.getTag('WTP_DEMAND_01')); // m³/h ra
    const pumpRun = this.pumpATripped ? 0 : 1;
    const feed = pumpRun * (cv / 100) * FEED_MAX;
    const out = demand + this.leak;
    const dtH = ctx.dtMs / 3_600_000;
    this.level = clamp(this.level + ((feed - out) * dtH) / TANK_VOL * 100, 0, 100);

    const m = (v: number, amp: number): number => v + this.rng.sym(amp);
    return {
      outputs: [
        { tagId: 'WTP_TANK_LEVEL_01', value: m(this.level, 0.1), quality: 'Good' },
        { tagId: 'WTP_FEED_FLOW_01', value: m(feed, 0.5), quality: 'Good' },
        { tagId: 'WTP_OUT_FLOW_01', value: m(out, 0.5), quality: 'Good' },
        { tagId: 'WTP_PUMP_A_RUN', value: pumpRun, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { level: this.level, pumpATripped: this.pumpATripped ? 1 : 0, leak: this.leak, rng: this.rng.state } };
  }

  restore(snapshot: ISimSnapshot): void {
    const s = snapshot.state;
    this.level = s.level ?? 40;
    this.pumpATripped = (s.pumpATripped ?? 0) === 1;
    this.leak = s.leak ?? 0;
    this.rng.state = s.rng ?? SEED;
  }

  injectMalfunction(mf: IMalfunction): void {
    if (mf.id === 'pump-a-trip') this.pumpATripped = true;
    else if (mf.id === 'tank-leak') this.leak = mf.params?.rate ?? 80;
  }

  clearMalfunction(id: string): void {
    if (id === 'pump-a-trip') this.pumpATripped = false;
    else if (id === 'tank-leak') this.leak = 0;
  }

  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

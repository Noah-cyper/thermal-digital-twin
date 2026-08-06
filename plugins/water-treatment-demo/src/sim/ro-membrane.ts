// Plugin water-treatment-demo — RoMembraneModel (ISimModel). CHỈ import @idtp/sdk (luật L-P1).
// Màng thẩm thấu ngược (RO): nước cấp DM → permeate (sạch) + reject (đậm muối). Lưu lượng permeate ∝ áp lực
// đẩy thực (NDP); độ khử muối ~99% → độ dẫn permeate thấp; bám màng làm ΔP tăng + suy thông lượng. Đây là
// quá trình VẬT LÝ KHÁC (không phải bể/mức) — bổ sung để chứng minh plugin mở rộng ĐỘC LẬP trên engine chung.
// Nhiễu đo seeded (không Math.random). Malfunction: 'membrane-fouling' (ΔP tăng, thông lượng giảm — stateful) ·
// 'membrane-breach' (khử muối tụt → độ dẫn permeate vọt). Số liệu demo [GIẢ ĐỊNH].
import type { ISimModel, ISimModelContext, ISimStepResult, ISimSnapshot, IMalfunction, TagId } from '@idtp/sdk';

const P_APPLIED_BAR = 15; // bar — áp bơm cao áp
const RECOVERY_NOM = 0.75; // — thu hồi permeate/feed danh định
const DP_NOM_BAR = 1.5; // bar — ΔP màng sạch
const K_DP_FOUL = 0.06; // bar / %bám — ΔP tăng theo bám
const SALT_REJECT_NOM = 99.2; // % — khử muối màng tốt
const SALT_REJECT_BREACH = 92; // % — khi thủng màng
const FEED_COND = 500; // µS/cm — độ dẫn nước cấp (brackish demo)
const FOUL_RATE_PER_MIN = 0.4; // %/phút — tốc độ tích bám khi sự cố
const FOUL_MAX = 60; // % — trần bám
const DP_HEALTHY_MAX = 3.5; // bar — ngưỡng ΔP lành mạnh
const COND_HEALTHY_MAX = 15; // µS/cm — ngưỡng độ dẫn permeate lành mạnh
const SEED = 0x5eed1234;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

class Lcg {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  sym(amp: number): number {
    this.s = (Math.imul(this.s, 1_664_525) + 1_013_904_223) >>> 0;
    return (this.s / 0x1_0000_0000 - 0.5) * 2 * amp;
  }
  get state(): number { return this.s; }
  set state(v: number) { this.s = v >>> 0; }
}

export class RoMembraneModel implements ISimModel {
  readonly id = 'water-ro-membrane';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'WTP_RO_FEED_PRESS_01', // bar — áp cấp cao áp
    'WTP_RO_PERMEATE_FLOW_01', // m³/h — permeate (nước sạch)
    'WTP_RO_REJECT_FLOW_01', // m³/h — reject (đậm muối)
    'WTP_RO_RECOVERY_01', // % — thu hồi
    'WTP_RO_DP_01', // bar — ΔP màng
    'WTP_RO_SALT_REJECT_01', // % — độ khử muối
    'WTP_RO_PERM_COND_01', // µS/cm — độ dẫn permeate
    'WTP_RO_HEALTHY_01', // 0/1 — màng bình thường
  ];

  private fouling = 0; // %
  private foulingActive = false;
  private breach = false;
  private rng = new Lcg(SEED);

  init(): void {
    this.fouling = 0;
    this.foulingActive = false;
    this.breach = false;
    this.rng = new Lcg(SEED);
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dtMin = ctx.dtMs / 60_000;
    const feed = Math.max(0, ctx.getTag('WTP_FEED_FLOW_01')); // m³/h — cấp từ bể (đã có)

    // Bám màng tích theo thời gian khi sự cố; suy thông lượng + tăng ΔP.
    if (this.foulingActive) this.fouling = clamp(this.fouling + FOUL_RATE_PER_MIN * dtMin, 0, FOUL_MAX);
    const foulFactor = 1 - this.fouling / 150; // bám → thông lượng giảm
    const dp = DP_NOM_BAR + K_DP_FOUL * this.fouling + this.rng.sym(0.03);

    const recovery = clamp(RECOVERY_NOM * foulFactor, 0.3, 0.85);
    const permeate = Math.max(0, feed * recovery);
    const reject = Math.max(0, feed - permeate);

    const saltReject = this.breach ? SALT_REJECT_BREACH : SALT_REJECT_NOM;
    const permCond = clamp(FEED_COND * (1 - saltReject / 100) + this.rng.sym(0.2), 0, 100);

    const healthy = dp <= DP_HEALTHY_MAX && permCond <= COND_HEALTHY_MAX && recovery >= 0.65 ? 1 : 0;

    return {
      outputs: [
        { tagId: 'WTP_RO_FEED_PRESS_01', value: P_APPLIED_BAR - dp * 0.3, quality: 'Good' },
        { tagId: 'WTP_RO_PERMEATE_FLOW_01', value: permeate, quality: 'Good' },
        { tagId: 'WTP_RO_REJECT_FLOW_01', value: reject, quality: 'Good' },
        { tagId: 'WTP_RO_RECOVERY_01', value: recovery * 100, quality: 'Good' },
        { tagId: 'WTP_RO_DP_01', value: dp, quality: 'Good' },
        { tagId: 'WTP_RO_SALT_REJECT_01', value: saltReject, quality: 'Good' },
        { tagId: 'WTP_RO_PERM_COND_01', value: permCond, quality: 'Good' },
        { tagId: 'WTP_RO_HEALTHY_01', value: healthy, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { fouling: this.fouling, foulingActive: this.foulingActive ? 1 : 0, breach: this.breach ? 1 : 0, rng: this.rng.state } };
  }
  restore(s: ISimSnapshot): void {
    this.fouling = s.state.fouling ?? 0;
    this.foulingActive = (s.state.foulingActive ?? 0) > 0.5;
    this.breach = (s.state.breach ?? 0) > 0.5;
    this.rng.state = s.state.rng ?? SEED;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'membrane-fouling') this.foulingActive = true;
    if (m.id === 'membrane-breach') this.breach = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'membrane-fouling') this.foulingActive = false;
    if (id === 'membrane-breach') this.breach = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

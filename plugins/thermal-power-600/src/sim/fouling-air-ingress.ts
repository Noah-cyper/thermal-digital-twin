// Plugin thermal-power-600 — FoulingAirIngressModel (ISimModel, doc 10 §6 — bám bẩn & lọt khí ĐỘNG).
// CHỈ import @idtp/sdk. CHIỀU SÂU vật lý theo THỜI GIAN (không tức thời): 2 quá trình suy giảm chậm mà
// CEMS/hiệu năng phản ánh dần —
//  • BÁM BẨN BỘ SẤY GIÓ (air heater): tro tích trên bề mặt theo thời gian → chênh áp gió-khói tăng, nhiệt
//    khói ra nóng lên, hiệu quả trao đổi giảm. Được LÀM SẠCH khi chu trình thổi bụi chạy (đọc SB_CYCLE_ACTIVE).
//  • LỌT KHÍ BÌNH NGƯNG (air in-leakage): khí trời lọt qua gioăng/khe chân không tăng dần (lão hoá) → vượt
//    năng lực SJAE thì chân không xấu đi + O₂ hoà tan tăng. Suất lọt khí là TRẠNG THÁI tiến hoá theo thời gian.
//
// ADDITIVE — sinh tag FA_* độc lập; KHÔNG đổi tag lõi (đọc-only, penalty là ƯỚC LƯỢNG chẩn đoán) ⇒ 0 hồi
// quy. Tất định (không Math.random). Có TRẠNG THÁI (chỉ số bám AH + suất lọt khí) → snapshot/restore.
// Malfunction: 'ah-fouling-accelerated' (bám AH nhanh) · 'condenser-air-leak' (lọt khí tăng vọt).
//
// Neo Design Basis (Phụ lục A): than tro 15% · chân không 5,4 kPa · SJAE. Tốc độ bám/làm sạch, suất lọt khí
// nền/năng lực SJAE, hệ số quy đổi penalty = [GIẢ ĐỊNH] GĐ-114 — số vận hành/kiểm định thật thay khi có.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const COAL_REF_TPH = 211;
const AH_FOUL_RATE_PCT_PER_H = 4; // %/giờ — tích bám AH ở than chuẩn
const AH_CLEAN_RATE_PCT_PER_H = 90; // %/giờ — hạ bám khi chu trình thổi bụi chạy (làm sạch AH)
const AH_FOUL_MIN = 5; // % — bám dư sau làm sạch
const AIR_INLEAK_NOM = 5; // scfm — lọt khí nền (kín tốt)
const AIR_INLEAK_LEAK = 55; // scfm — lọt khí khi sự cố gioăng/khe
const SJAE_CAP_SCFM = 40; // scfm — năng lực hút khí SJAE
const AIR_TAU_H = 0.5; // giờ — hằng thời gian suất lọt khí tiến tới đích

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class FoulingAirIngressModel implements ISimModel {
  readonly id = 'thermal-fouling-air-ingress';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'FA_AH_FOULING_01', // % — chỉ số bám bộ sấy gió (tiến hoá theo thời gian)
    'FA_AH_GAS_DP_01', // kPa — chênh áp gió-khói qua AH (tăng theo bám)
    'FA_AH_GAS_EXIT_DT_01', // °C — độ tăng nhiệt khói ra do bám AH
    'FA_AH_EFFECTIVENESS_01', // % — hiệu quả trao đổi nhiệt AH
    'FA_COND_AIR_INLEAK_01', // scfm — suất lọt khí bình ngưng
    'FA_COND_VAC_PENALTY_01', // kPa — xấu chân không do lọt khí vượt năng lực SJAE
    'FA_SJAE_MARGIN_01', // % — biên năng lực SJAE còn lại
    'FA_FOULING_HEALTHY_01', // 0/1 — bám AH & lọt khí trong ngưỡng bình thường
  ];

  private ahFouling = 10; // %
  private airInleak = AIR_INLEAK_NOM; // scfm
  private ahAccel = false;
  private airLeak = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.ahFouling = 10;
    this.airInleak = AIR_INLEAK_NOM;
    this.ahAccel = false;
    this.airLeak = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dtH = ctx.dtMs / 3_600_000;
    const coal = Math.max(0, ctx.getTag('BLR_COAL_FLOW_01'));
    const coalFrac = coal / COAL_REF_TPH;
    const sootBlowActive = ctx.getTag('SB_CYCLE_ACTIVE_01') > 0.5; // chu trình thổi bụi → làm sạch AH

    // Bám AH: tích tụ ∝ than-tro; hạ khi thổi bụi (đọc SB_CYCLE_ACTIVE). Sự cố → tích nhanh gấp bội.
    const foulRate = AH_FOUL_RATE_PCT_PER_H * coalFrac * (this.ahAccel ? 4 : 1);
    if (sootBlowActive) this.ahFouling = clamp(this.ahFouling - AH_CLEAN_RATE_PCT_PER_H * dtH, AH_FOUL_MIN, 100);
    else this.ahFouling = clamp(this.ahFouling + foulRate * dtH, AH_FOUL_MIN, 100);

    // Lọt khí: tiến tới đích (nền hoặc sự cố) với hằng thời gian → TIẾN HOÁ theo thời gian (không nhảy tức thời).
    const airTarget = this.airLeak ? AIR_INLEAK_LEAK : AIR_INLEAK_NOM;
    this.airInleak += (airTarget - this.airInleak) * clamp(dtH / AIR_TAU_H, 0, 1);

    const ahGasDp = 0.8 + this.ahFouling * 0.02; // kPa
    const ahGasExitDt = this.ahFouling * 0.6; // °C
    const ahEffectiveness = clamp(88 - this.ahFouling * 0.4, 40, 90); // %
    const sjaeMargin = clamp(100 - (this.airInleak / SJAE_CAP_SCFM) * 100, 0, 100); // %
    const vacPenalty = Math.max(0, (this.airInleak - SJAE_CAP_SCFM) * 0.06); // kPa (chỉ khi vượt năng lực SJAE)
    const healthy = this.ahFouling < 40 && this.airInleak < SJAE_CAP_SCFM;

    return {
      outputs: [
        { tagId: 'FA_AH_FOULING_01', value: this.ahFouling, quality: 'Good' },
        { tagId: 'FA_AH_GAS_DP_01', value: ahGasDp, quality: 'Good' },
        { tagId: 'FA_AH_GAS_EXIT_DT_01', value: ahGasExitDt, quality: 'Good' },
        { tagId: 'FA_AH_EFFECTIVENESS_01', value: ahEffectiveness, quality: 'Good' },
        { tagId: 'FA_COND_AIR_INLEAK_01', value: this.airInleak, quality: 'Good' },
        { tagId: 'FA_COND_VAC_PENALTY_01', value: vacPenalty, quality: 'Good' },
        { tagId: 'FA_SJAE_MARGIN_01', value: sjaeMargin, quality: 'Good' },
        { tagId: 'FA_FOULING_HEALTHY_01', value: healthy ? 1 : 0, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { ahFouling: this.ahFouling, airInleak: this.airInleak, ahAccel: this.ahAccel ? 1 : 0, airLeak: this.airLeak ? 1 : 0 } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.ahFouling = snapshot.state.ahFouling ?? 10;
    this.airInleak = snapshot.state.airInleak ?? AIR_INLEAK_NOM;
    this.ahAccel = (snapshot.state.ahAccel ?? 0) > 0.5;
    this.airLeak = (snapshot.state.airLeak ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'ah-fouling-accelerated') this.ahAccel = true;
    if (m.id === 'condenser-air-leak') this.airLeak = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'ah-fouling-accelerated') this.ahAccel = false;
    if (id === 'condenser-air-leak') this.airLeak = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

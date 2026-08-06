// Plugin thermal-power-600 — TurbineStressModel (ISimModel, doc 10 §7 — TSE: đánh giá ứng suất nhiệt rotor).
// CHỈ import @idtp/sdk. CHIỀU SÂU vật lý thân turbine: chênh nhiệt BỀ MẶT–TÂM rotor (ΔT) sinh ỨNG SUẤT NHIỆT.
// Bề mặt rotor bám nhiệt hơi nhanh; tâm rotor (bore) trễ (khối kim loại lớn) → khi ĐỔI TẢI/nhiệt nhanh, ΔT
// vọt → ứng suất → tiêu hao TUỔI THỌ mỏi chu kỳ thấp (low-cycle fatigue). TSE giới hạn TỐC ĐỘ TẢI theo biên
// ứng suất — hệ supervisory thật. Đọc GEN_MW_01 (tải) + BLR_MSTM_SH_TEMP_01 (nhiệt hơi chính) → nhiệt kim
// loại mục tiêu → bề mặt (nhanh) vs tâm (chậm) → ΔT → % ứng suất → ramp limit cho phép + tiêu hao tuổi thọ.
//
// ADDITIVE — sinh tag TSE_* ĐỘC LẬP; KHÔNG đổi tag turbine lõi (0 hồi quy). Tất định (không Math.random). Có
// TRẠNG THÁI (nhiệt bề mặt/tâm + tuổi thọ tích luỹ) → snapshot/restore. Malfunction: 'fast-startup' (xung
// gia nhiệt bề mặt nhanh → ΔT vọt) · 'thermal-shock' (lệch nhiệt hơi đột ngột → ΔT offset).
//
// Neo Design Basis (Phụ lục A §3.3): turbine reheat, hơi chính ~541 °C. Chênh cho phép bề mặt–tâm 60 °C,
// tốc độ tải tối đa 5 %/phút, hệ số tuổi thọ mỏi, hằng thời gian nhiệt bề mặt/tâm = [GIẢ ĐỊNH].
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const METAL_BASE_C = 300; // °C — nhiệt kim loại rotor ở tải rất thấp (partial admission)
const METAL_SPAN_C = 240; // °C — dải tăng theo tải (đầy tải ≈ 540 °C, bám hơi chính)
const TAU_SURF_S = 20; // s — hằng thời gian nhiệt BỀ MẶT rotor (nhanh)
const TAU_BORE_S = 260; // s — hằng thời gian nhiệt TÂM rotor (chậm, khối lớn)
const DT_ALLOW_C = 60; // °C — chênh bề mặt–tâm cho phép (ngưỡng ứng suất 100%)
const MAX_RAMP_MW_MIN = 30; // MW/phút — tốc độ tải tối đa khi biên ứng suất đầy (5% MCR)
const STRESS_HEALTHY_MAX = 90; // % — ngưỡng ứng suất lành mạnh
const FORCING_C = 120; // °C — xung gia nhiệt bề mặt khi fast-startup (vượt ngưỡng → vi phạm)
const SHOCK_C = 65; // °C — offset ΔT khi thermal-shock (vượt ngưỡng)
const TAU_EVENT_S = 70; // s — phân rã xung/shock
const LIFE_K = 1e-3; // — hệ số tiêu hao tuổi thọ mỗi phút ở ứng suất trên ngưỡng (demo, [GIẢ ĐỊNH])
const LIFE_THRESH = 50; // % — ứng suất dưới ngưỡng này coi như không tiêu hao đáng kể

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class TurbineStressModel implements ISimModel {
  readonly id = 'thermal-turbine-stress';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'TSE_SURFACE_TEMP_01', // °C — nhiệt bề mặt rotor
    'TSE_BORE_TEMP_01', // °C — nhiệt tâm rotor
    'TSE_ROTOR_DT_01', // °C — chênh bề mặt–tâm
    'TSE_STRESS_PCT_01', // % — ứng suất so cho phép
    'TSE_MARGIN_01', // % — biên ứng suất còn lại
    'TSE_RAMP_LIMIT_01', // MW/phút — tốc độ tải cho phép hiện tại
    'TSE_LIFE_USED_01', // % — tiêu hao tuổi thọ tích luỹ (mỏi chu kỳ thấp)
    'TSE_HEALTHY_01', // 0/1 — ứng suất trong ngưỡng
  ];

  private surface = 540; // °C
  private bore = 540; // °C
  private lifeUsed = 0; // %
  private forcing = 0; // °C — xung fast-startup (phân rã)
  private shock = 0; // °C — offset thermal-shock (phân rã)
  private soaked = false; // đã thấm nhiệt điểm vận hành (khởi tạo lười theo tải thực)

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.surface = 540;
    this.bore = 540;
    this.lifeUsed = 0;
    this.forcing = 0;
    this.shock = 0;
    this.soaked = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dt = ctx.dtMs / 1000;
    const loadFrac = clamp(Math.max(0, ctx.getTag('GEN_MW_01')) / 600, 0, 1.1);
    const steamT = ctx.getTag('BLR_MSTM_SH_TEMP_01') || 540;

    // Nhiệt kim loại mục tiêu: bám hơi chính, giảm ở tải thấp (partial admission first-stage nguội hơn).
    const metalTarget = clamp(Math.min(steamT, METAL_BASE_C + METAL_SPAN_C * loadFrac), 100, 600);

    // Khởi tạo lười: bước đầu rotor coi như ĐÃ THẤM NHIỆT ở tải hiện tại → ΔT khởi điểm 0 (không transient giả).
    if (!this.soaked) {
      this.surface = metalTarget;
      this.bore = metalTarget;
      this.soaked = true;
    }

    // Xung sự cố phân rã về 0.
    this.forcing += (0 - this.forcing) * (dt / TAU_EVENT_S);
    this.shock += (0 - this.shock) * (dt / TAU_EVENT_S);

    // Bề mặt bám nhanh (+ xung fast-startup); tâm trễ theo bề mặt.
    this.surface += ((metalTarget + this.forcing) - this.surface) * (dt / TAU_SURF_S);
    this.bore += (this.surface - this.bore) * (dt / TAU_BORE_S);

    const dT = this.surface - this.bore + this.shock;
    const stressPct = clamp((Math.abs(dT) / DT_ALLOW_C) * 100, 0, 300);
    const margin = clamp(100 - stressPct, 0, 100);
    const rampLimit = MAX_RAMP_MW_MIN * (margin / 100); // ứng suất cao → giảm tốc độ tải cho phép

    // Tiêu hao tuổi thọ mỏi: chỉ tích khi ứng suất trên ngưỡng (∝ (vượt ngưỡng)² theo thời gian).
    if (stressPct > LIFE_THRESH) {
      const over = (stressPct - LIFE_THRESH) / 50;
      this.lifeUsed += LIFE_K * over * over * (dt / 60);
    }

    const healthy = stressPct <= STRESS_HEALTHY_MAX ? 1 : 0;

    return {
      outputs: [
        { tagId: 'TSE_SURFACE_TEMP_01', value: this.surface, quality: 'Good' },
        { tagId: 'TSE_BORE_TEMP_01', value: this.bore, quality: 'Good' },
        { tagId: 'TSE_ROTOR_DT_01', value: dT, quality: 'Good' },
        { tagId: 'TSE_STRESS_PCT_01', value: stressPct, quality: 'Good' },
        { tagId: 'TSE_MARGIN_01', value: margin, quality: 'Good' },
        { tagId: 'TSE_RAMP_LIMIT_01', value: rampLimit, quality: 'Good' },
        { tagId: 'TSE_LIFE_USED_01', value: this.lifeUsed, quality: 'Good' },
        { tagId: 'TSE_HEALTHY_01', value: healthy, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { surface: this.surface, bore: this.bore, lifeUsed: this.lifeUsed, forcing: this.forcing, shock: this.shock, soaked: this.soaked ? 1 : 0 } };
  }
  restore(s: ISimSnapshot): void {
    this.surface = s.state.surface ?? 540;
    this.bore = s.state.bore ?? 540;
    this.lifeUsed = s.state.lifeUsed ?? 0;
    this.forcing = s.state.forcing ?? 0;
    this.shock = s.state.shock ?? 0;
    this.soaked = (s.state.soaked ?? 1) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'fast-startup') this.forcing = FORCING_C;
    if (m.id === 'thermal-shock') this.shock = SHOCK_C;
  }
  clearMalfunction(id: string): void {
    if (id === 'fast-startup') this.forcing = 0;
    if (id === 'thermal-shock') this.shock = 0;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

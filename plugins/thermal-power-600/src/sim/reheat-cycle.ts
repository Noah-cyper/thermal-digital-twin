// Plugin thermal-power-600 — ReheatCycleModel (ISimModel, doc 10 §6 — chu trình TÁI NHIỆT + turbine
// nhiều tầng). CHỈ import @idtp/sdk. CHIỀU SÂU vật lý bổ sung (v1.18), chạy CẠNH BoilerIsland +
// TurbineGenerator: đọc hơi chính/áp/nhiệt/công suất tươi → sinh THÊM tag đường tái nhiệt (cold/hot
// reheat) + tách công suất HP/IP/LP + nhiệt lượng reheater. ADDITIVE — KHÔNG đổi GEN_MW_01 (0 hồi quy);
// các tầng CỘNG lại ≈ GEN_MW_01. Tất định (không Math.random).
//
// Neo Design Basis (Phụ lục A §Turbine/Steam): hơi chính 17,5 MPa/541 °C · cold reheat (RH in)
// 4,2 MPa/330 °C · hot reheat (RH out) 3,8 MPa/541 °C · chân không 5,4 kPa · BMCR 2.008 t/h · 600 MW ·
// tandem-compound HP+IP+2×LP. Phân bổ công suất tầng & enthalpy drop = [GIẢ ĐỊNH] (GĐ-65) — số từ heat
// balance thật lấy khi có; ở đây suy từ áp/nhiệt Design Basis.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

/* ── Design Basis (Phụ lục A) ── */
const P_MSTM_NOM_MPA = 17.5; // hơi chính SH out
const P_CRH_NOM_MPA = 4.2; // cold reheat (HP exhaust / RH in)
const P_HRH_NOM_MPA = 3.8; // hot reheat (RH out)
const T_MSTM_NOM_C = 541; // hơi chính
const T_CRH_NOM_C = 330; // RH in (HP exhaust)
const T_HRH_NOM_C = 541; // RH out (điều nhiệt reheater ~ = hơi chính)

/* ── [GIẢ ĐỊNH] hiệu chỉnh (GĐ-65), suy từ áp/nhiệt Design Basis ── */
const PR_HP = P_CRH_NOM_MPA / P_MSTM_NOM_MPA; // ~0,24 — tỷ số áp qua tầng HP (cố định → CRH trượt theo hơi chính)
const RH_DP_MPA = P_CRH_NOM_MPA - P_HRH_NOM_MPA; // 0,4 — sụt áp qua reheater
const DT_HP_C = T_MSTM_NOM_C - T_CRH_NOM_C; // 211 — chênh nhiệt qua tầng HP
const HRH_DROOP_C = 60; // droop nhiệt hot reheat ở non tải (điều nhiệt gas-side không tới đích khi tải thấp)
const K_RH_BIAS_C = 30; // °C nâng hot reheat ở 100% gas-biasing (burner tilt / gas recirc) — bù droop non tải
const T_HRH_MAX_C = 565; // giới hạn nhiệt kim loại hot reheat
// Phân bổ công suất trục theo enthalpy drop xấp xỉ (HP ~380, IP+LP ~1200 kJ/kg từ bảng hơi ở áp/nhiệt DB):
const F_HP = 0.28; // tầng cao áp
const F_IP = 0.30; // trung áp (sau reheat)
const F_LP = 0.42; // hạ áp (2×LP) → tổng = 1,00
const REHEAT_DH_KJKG = 526; // enthalpy cấp thêm ở reheater ≈ h(3,8/541) − h(4,2/330)
const IDLE_TEMP_C = 200; // nhiệt kim loại đường hơi khi mất lưu lượng (MFT)
const TAU_RH_S = 30; // quán tính nhiệt reheater

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class ReheatCycleModel implements ISimModel {
  readonly id = 'thermal-reheat-cycle';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'TRB_CRH_PRESS_01', // MPa — cold reheat (HP exhaust)
    'TRB_CRH_TEMP_01', // °C — cold reheat
    'TRB_HRH_PRESS_01', // MPa — hot reheat (RH out)
    'TRB_HRH_TEMP_01', // °C — hot reheat
    'TRB_HP_MW_01', // MW — công suất tầng cao áp
    'TRB_IP_MW_01', // MW — công suất tầng trung áp
    'TRB_LP_MW_01', // MW — công suất tầng hạ áp (2×LP)
    'TRB_REHEAT_DUTY_01', // MWth — nhiệt lượng reheater
  ];

  private crhTemp = T_CRH_NOM_C;
  private hrhTemp = T_HRH_NOM_C;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.crhTemp = T_CRH_NOM_C;
    this.hrhTemp = T_HRH_NOM_C;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dt = ctx.dtMs / 1000;
    const pin = Math.max(0, ctx.getTag('BLR_MSTM_SH_PRESS_01')); // MPa hơi chính
    const shTemp = Math.max(0, ctx.getTag('BLR_MSTM_SH_TEMP_01')); // °C hơi chính
    const steam = Math.max(0, ctx.getTag('BLR_STEAM_FLOW_01')); // t/h
    const mw = Math.max(0, ctx.getTag('GEN_MW_01')); // MW (trục — không đổi)
    const flowRatio = clamp(steam / 2008, 0, 1.1); // so BMCR
    const hasFlow = steam > 50; // đủ lưu lượng để tính nhiệt hơi (dưới ngưỡng = MFT/coast-down)

    // Áp đường reheat TRƯỢT theo áp hơi chính (turbine follow): CRH = pin·PR_HP; HRH = CRH − ΔP_reheater.
    const crhPress = pin * PR_HP;
    const hrhPress = Math.max(0, crhPress - RH_DP_MPA);

    // Nhiệt: CRH bám (hơi chính − ΔT_HP); HRH có droop non tải, được BÙ bằng gas-biasing (loop reheat-temp
    // điều TRB_RH_BIAS_01 để giữ 541 °C trên dải tải). Không cấp gió biasing → droop như cũ (mặc định 0).
    const crhTarget = hasFlow ? Math.max(IDLE_TEMP_C, shTemp - DT_HP_C) : IDLE_TEMP_C;
    const rhBias = clamp(ctx.getTag('TRB_RH_BIAS_01'), 0, 100);
    const hrhTarget = hasFlow
      ? clamp(Math.min(T_HRH_NOM_C, shTemp) - HRH_DROOP_C * (1 - clamp(flowRatio, 0, 1)) + K_RH_BIAS_C * (rhBias / 100), IDLE_TEMP_C, T_HRH_MAX_C)
      : IDLE_TEMP_C;
    this.crhTemp += (crhTarget - this.crhTemp) * (dt / TAU_RH_S);
    this.hrhTemp += (hrhTarget - this.hrhTemp) * (dt / TAU_RH_S);

    // Tách công suất trục theo tầng (cộng lại = mw → additive, không đổi GEN_MW_01).
    const hpMw = mw * F_HP;
    const ipMw = mw * F_IP;
    const lpMw = mw * F_LP;

    // Nhiệt lượng reheater (MWth) = ṁ(kg/s)·Δh_reheat; ṁ = steam(t/h)/3,6.
    const reheatDuty = hasFlow ? (steam / 3.6) * (REHEAT_DH_KJKG / 1000) : 0;

    return {
      outputs: [
        { tagId: 'TRB_CRH_PRESS_01', value: crhPress, quality: 'Good' },
        { tagId: 'TRB_CRH_TEMP_01', value: this.crhTemp, quality: 'Good' },
        { tagId: 'TRB_HRH_PRESS_01', value: hrhPress, quality: 'Good' },
        { tagId: 'TRB_HRH_TEMP_01', value: this.hrhTemp, quality: 'Good' },
        { tagId: 'TRB_HP_MW_01', value: hpMw, quality: 'Good' },
        { tagId: 'TRB_IP_MW_01', value: ipMw, quality: 'Good' },
        { tagId: 'TRB_LP_MW_01', value: lpMw, quality: 'Good' },
        { tagId: 'TRB_REHEAT_DUTY_01', value: reheatDuty, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { crhTemp: this.crhTemp, hrhTemp: this.hrhTemp } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.crhTemp = snapshot.state.crhTemp ?? T_CRH_NOM_C;
    this.hrhTemp = snapshot.state.hrhTemp ?? T_HRH_NOM_C;
  }
  injectMalfunction(_m: IMalfunction): void {
    // model không có malfunction riêng ở v1.18
  }
  clearMalfunction(_id: string): void {
    // không giữ trạng thái malfunction
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

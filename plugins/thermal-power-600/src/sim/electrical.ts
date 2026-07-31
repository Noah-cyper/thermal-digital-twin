// Plugin thermal-power-600 — ElectricalModel (ISimModel, doc 10 §7 — máy phát → GSU → lưới + tự dùng).
// CHỈ import @idtp/sdk. CHIỀU SÂU vật lý bổ sung (v1.23), chạy CẠNH …/turbine: đọc công suất gộp/phản
// kháng tươi → phía ĐIỆN: tự dùng (house load), công suất TINH (net = gộp − tự dùng), công suất biểu
// kiến, hệ số công suất, dòng stator, tải GSU/UAT, xuất lưới. ADDITIVE — không đổi GEN_MW_01/GEN_MVAR_01
// (0 hồi quy). Tất định (không Math.random).
//
// Neo Design Basis (Phụ lục A §3.3): gộp/tinh 600/558 MW (tự dùng ~7 %) · lưới 500 kV/50 Hz · máy phát
// 667 MVA, 20 kV, cosφ 0,9 · GSU 20/500 kV, 720 MVA, YNd11 · UAT 20/6,6 kV, 2×50 MVA. Phân bổ tự dùng
// nền/biến thiên, tổn thất GSU = [GIẢ ĐỊNH] (GĐ-70) — số thử nghiệm thật thay khi có.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

/* ── Design Basis (Phụ lục A §3.3) ── */
const MW_GROSS = 600;
const GEN_MVA_RATED = 667;
const GEN_KV = 20;
const GSU_MVA_RATED = 720;
const UAT_MVA_RATED = 100; // 2 × 50 MVA

/* ── [GIẢ ĐỊNH] hiệu chỉnh (GĐ-70) — tổng tự dùng đầy tải = 42 MW (=7 % → net 558) ── */
const AUX_BASE_MW = 12; // tự dùng nền (điều khiển, chiếu sáng, bơm phụ)
const AUX_VAR_MW = 30; // tự dùng biến thiên theo tải (mill, quạt, BFP, bơm CW)
const AUX_PF = 0.9; // hệ số công suất tải tự dùng
const GSU_LOSS_FRAC = 0.004; // tổn thất máy biến áp chính ~0,4 %
/* ── Làm mát máy phát (H₂ pressure + stator cooling water temp) — GĐ-86 ── */
const P_H2_MIN_MPA = 0.2; // áp khí H₂ nền khi van cấp đóng
const K_H2_VALVE_MPA = 0.4; // đóng góp áp toàn hành trình van cấp H₂ (bù rò seal) → giữ 0,4 MPa ở ~50%
const T_STATOR_CW_AMB_C = 38; // nhiệt nước làm mát stator vào (từ hệ nước làm mát khép kín CCW)
const K_STATOR_HEAT_C = 20; // °C tăng do I²R stator theo tải
const K_STATOR_COOL_C = 15; // °C giảm toàn hành trình van nước làm mát stator
/* ── Hoàn thiện hệ H₂ máy phát (gas temp + seal oil dP) — GĐ-88 ── */
const T_H2_GAS_MIN_C = 30; // nhiệt khí H₂ nền (approach tới cooler)
const K_H2_HEAT_C = 22; // °C tăng khí H₂ theo tải (nhiệt máy phát)
const K_H2_COOL_C = 18; // °C giảm toàn hành trình van CW cooler H₂
const DP_SEAL_MIN_MPA = 0.02; // dP seal oil nền
const K_SEAL_OIL_MPA = 0.12; // dP toàn hành trình van seal oil → giữ 0,08 MPa ở ~50%

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class ElectricalModel implements ISimModel {
  readonly id = 'thermal-electrical';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'ELEC_AUX_POWER_01', // MW — tự dùng (house load)
    'ELEC_NET_MW_01', // MW — công suất tinh (net = gộp − tự dùng)
    'ELEC_GRID_MW_01', // MW — xuất lưới (sau tổn thất GSU)
    'ELEC_GEN_MVA_01', // MVA — công suất biểu kiến máy phát
    'ELEC_PF_01', // — hệ số công suất
    'ELEC_GEN_CURRENT_01', // kA — dòng stator ở 20 kV
    'ELEC_GSU_LOADING_01', // % — tải máy biến áp chính
    'ELEC_AUX_LOADING_01', // % — tải biến áp tự dùng UAT
    // Chiều sâu SCADA: 2 phân đoạn thanh cái tự dùng 6,6 kV (A/B, mỗi board 50% qua 2×UAT 50 MVA).
    'ELEC_AUX_A_MW_01',
    'ELEC_AUX_B_MW_01',
    'ELEC_BREAKER_01', // trạng thái máy cắt máy phát (1 = đóng/hoà lưới · 0 = mở/tách lưới do trip)
    'ELEC_H2_PRESS_01', // MPa — áp khí H₂ làm mát máy phát (van cấp giữ 0,4 MPa)
    'ELEC_STATOR_CW_TEMP_01', // °C — nhiệt nước làm mát stator (van nước làm mát giữ 45 °C)
    'ELEC_H2_TEMP_01', // °C — nhiệt khí H₂ làm mát (van CW cooler H₂ giữ 40 °C)
    'ELEC_SEAL_OIL_DP_01', // MPa — chênh áp seal oil − H₂ (van seal oil giữ 0,08 MPa chống rò H₂)
  ];

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    // model không giữ trạng thái (điện tức thời theo công suất; đầu vào đã có quán tính)
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const mw = Math.max(0, ctx.getTag('GEN_MW_01')); // MW gộp
    const mvar = Math.max(0, ctx.getTag('GEN_MVAR_01')); // MVAr
    // Máy cắt máy phát MỞ do C&E (turbine trip → tách lưới). Tách lưới → không xuất lưới, không phát MVA;
    // tổ máy VẪN cần tự dùng nền (dầu bôi trơn, turning gear, bơm phụ) → NHẬP từ lưới qua MBA khởi động.
    const breakerOpen = ctx.getTag('GEN_BREAKER_TRIP') > 0;
    const online = mw > 1 && !breakerOpen; // máy phát mang tải & hoà lưới
    const loadFrac = clamp(mw / MW_GROSS, 0, 1.1);

    // Tự dùng: nền + biến thiên theo tải khi hoà lưới; tách lưới → chỉ còn tự dùng nền (nhập từ lưới).
    const aux = online ? AUX_BASE_MW + AUX_VAR_MW * loadFrac : breakerOpen ? AUX_BASE_MW : 0;
    // Công suất TINH = gộp − tự dùng khi hoà lưới; tách lưới → net ÂM (nhập tự dùng nền từ lưới).
    const netMw = online ? mw - aux : breakerOpen ? -aux : 0;

    // Công suất biểu kiến & hệ số công suất từ P/Q; dòng stator ở 20 kV (3 pha). Tách lưới → máy phát 0.
    const mva = online ? Math.sqrt(mw * mw + mvar * mvar) : 0;
    const pf = mva > 1e-3 ? clamp(mw / mva, 0, 1) : 1;
    const current = online ? (mva * 1e6) / (Math.sqrt(3) * GEN_KV * 1000) / 1000 : 0; // kA

    // Xuất lưới sau tổn thất GSU (0 khi tách lưới); tải các máy biến áp.
    const gridMw = online && netMw > 0 ? netMw * (1 - GSU_LOSS_FRAC) : 0;
    const gsuLoading = (mva / GSU_MVA_RATED) * 100;
    const auxLoading = aux > 0 ? (aux / AUX_PF / UAT_MVA_RATED) * 100 : 0;

    // Làm mát máy phát (chạy liên tục, độc lập hoà lưới): (1) áp khí H₂ giữ 0,4 MPa bù rò seal (van cấp
    // ELEC_H2_VALVE_01, direct); (2) nhiệt nước làm mát stator giữ 45 °C — I²R theo tải làm nóng, van nước
    // làm mát ELEC_STATOR_CW_VALVE_01 hạ nhiệt (reverse). Derived thuần (gain nhỏ → ổn định, không quán tính).
    const h2Valve = clamp(ctx.getTag('ELEC_H2_VALVE_01'), 0, 100);
    const h2Press = P_H2_MIN_MPA + (h2Valve / 100) * K_H2_VALVE_MPA;
    const statorCwValve = clamp(ctx.getTag('ELEC_STATOR_CW_VALVE_01'), 0, 100);
    const statorCwTemp = T_STATOR_CW_AMB_C + K_STATOR_HEAT_C * loadFrac - K_STATOR_COOL_C * (statorCwValve / 100);
    // Hoàn thiện hệ H₂: (3) nhiệt khí H₂ — máy phát nóng theo tải, van CW cooler H₂ hạ (reverse) giữ 40 °C;
    // (4) chênh áp seal oil − H₂ giữ 0,08 MPa bằng van seal oil (direct) để dầu chèn ép H₂ không rò ra ngoài.
    const h2CwValve = clamp(ctx.getTag('ELEC_H2_CW_VALVE_01'), 0, 100);
    const h2Temp = T_H2_GAS_MIN_C + K_H2_HEAT_C * loadFrac - K_H2_COOL_C * (h2CwValve / 100);
    const sealOilValve = clamp(ctx.getTag('ELEC_SEAL_OIL_VALVE_01'), 0, 100);
    const sealOilDp = DP_SEAL_MIN_MPA + (sealOilValve / 100) * K_SEAL_OIL_MPA;

    return {
      outputs: [
        { tagId: 'ELEC_AUX_POWER_01', value: aux, quality: 'Good' },
        { tagId: 'ELEC_NET_MW_01', value: netMw, quality: 'Good' },
        { tagId: 'ELEC_GRID_MW_01', value: gridMw, quality: 'Good' },
        { tagId: 'ELEC_GEN_MVA_01', value: mva, quality: 'Good' },
        { tagId: 'ELEC_PF_01', value: pf, quality: 'Good' },
        { tagId: 'ELEC_GEN_CURRENT_01', value: current, quality: 'Good' },
        { tagId: 'ELEC_GSU_LOADING_01', value: gsuLoading, quality: 'Good' },
        { tagId: 'ELEC_AUX_LOADING_01', value: auxLoading, quality: 'Good' },
        { tagId: 'ELEC_AUX_A_MW_01', value: aux / 2, quality: 'Good' },
        { tagId: 'ELEC_AUX_B_MW_01', value: aux / 2, quality: 'Good' },
        { tagId: 'ELEC_BREAKER_01', value: breakerOpen ? 0 : 1, quality: 'Good' },
        { tagId: 'ELEC_H2_PRESS_01', value: h2Press, quality: 'Good' },
        { tagId: 'ELEC_STATOR_CW_TEMP_01', value: statorCwTemp, quality: 'Good' },
        { tagId: 'ELEC_H2_TEMP_01', value: h2Temp, quality: 'Good' },
        { tagId: 'ELEC_SEAL_OIL_DP_01', value: sealOilDp, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: {} };
  }
  restore(_snapshot: ISimSnapshot): void {
    // không giữ trạng thái
  }
  injectMalfunction(_m: IMalfunction): void {
    // model không có malfunction riêng ở v1.23
  }
  clearMalfunction(_id: string): void {
    // không giữ trạng thái malfunction
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

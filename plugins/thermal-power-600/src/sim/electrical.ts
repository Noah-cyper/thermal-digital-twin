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

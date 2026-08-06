// Plugin thermal-power-600 — LubeOilSystemModel (ISimModel, doc 10 §7 — hệ dầu bôi trơn gối trục turbine).
// CHỈ import @idtp/sdk. CHIỀU SÂU phụ trợ turbine: bể dầu · bộ làm mát · LỌC dầu (ΔP tăng khi tắc) · logic
// BƠM DẦU 3 cấp (MOP trục chính / AOP xoay chiều dự phòng / EOP một chiều khẩn) · biên nhiệt gối. Khi bơm
// chính trip hoặc lọc tắc → áp header tụt → AOP tự khởi động; tụt sâu → EOP DC cứu màng dầu gối (bảo vệ trục).
// Đọc GEN_MW_01 (tải → sinh nhiệt ma sát) + TRB_BRG_TEMP_01 (nhiệt gối) → sinh tag LUBE_*.
//
// ADDITIVE — sinh tag LUBE_* ĐỘC LẬP; KHÔNG đổi tag turbine lõi (0 hồi quy). Tất định (không Math.random). Có
// TRẠNG THÁI (tắc lọc tích luỹ + cờ sự cố) → snapshot/restore. Malfunction: 'oil-cooler-fouling' (nhiệt dầu
// tăng) · 'oil-filter-clog' (ΔP lọc tăng → áp tụt → AOP) · 'mop-trip' (bơm chính trip → AOP/EOP cứu).
//
// Neo Design Basis (Phụ lục A §3.3): bơm dầu MOP trục + AOP AC + EOP DC; áp header ~0,2 MPa, nhiệt dầu ~45 °C,
// nhiệt gối trip 120 °C. Ngưỡng khởi bơm, ΔP lọc, hệ số nhiệt dầu = [GIẢ ĐỊNH].
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const RES_TEMP_BASE_C = 45; // °C — nhiệt bể dầu nền
const RES_RISE_FULL_C = 12; // °C — tăng theo tải (ma sát gối)
const COOLER_FOUL_C = 14; // °C — nhiệt dầu tăng khi bộ làm mát bám bẩn
const COOLER_DROP_C = 8; // °C — hạ nhiệt qua bộ làm mát (CW)
const DP_CLEAN_BAR = 0.3; // bar — ΔP lọc sạch
const FILTER_CLOG_RATE = 0.15; // bar/phút — tắc lọc tích luỹ
const DP_MAX_BAR = 2.5; // bar — trần ΔP lọc
const HEADER_NOM_MPA = 0.20; // MPa — áp header khi MOP chạy
const HEADER_MOP_TRIP_MPA = 0.06; // MPa — áp khi mất MOP (chưa bơm dự phòng)
const HEADER_AOP_MPA = 0.18; // MPa — áp AOP giữ
const HEADER_EOP_MPA = 0.14; // MPa — áp EOP DC giữ (cứu màng dầu)
const AOP_START_MPA = 0.15; // MPa — ngưỡng tự khởi AOP
const EOP_START_MPA = 0.10; // MPa — ngưỡng tự khởi EOP
const K_DP_PRESS = 0.06; // MPa/bar — ΔP lọc vượt sạch làm tụt áp header
const BRG_TRIP_C = 120; // °C — nhiệt gối trip
const RES_HEALTHY_MAX_C = 60; // °C — nhiệt dầu lành mạnh
const HEADER_HEALTHY_MIN_MPA = 0.15; // MPa — áp header lành mạnh

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class LubeOilSystemModel implements ISimModel {
  readonly id = 'thermal-lube-oil-system';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'LUBE_RESERVOIR_TEMP_01', // °C — nhiệt bể dầu
    'LUBE_COOLER_OUT_TEMP_01', // °C — nhiệt dầu ra bộ làm mát
    'LUBE_FILTER_DP_01', // bar — ΔP lọc dầu
    'LUBE_HEADER_PRESS_01', // MPa — áp header dầu bôi trơn
    'LUBE_MOP_RUN_01', // 0/1 — bơm chính (trục)
    'LUBE_AOP_RUN_01', // 0/1 — bơm phụ AC (tự khởi khi áp thấp)
    'LUBE_EOP_RUN_01', // 0/1 — bơm khẩn DC (tự khởi khi áp rất thấp)
    'LUBE_BRG_MARGIN_01', // °C — biên nhiệt gối tới trip
    'LUBE_HEALTHY_01', // 0/1 — hệ dầu bình thường
  ];

  private filterDp = DP_CLEAN_BAR; // bar
  private coolerFouling = false;
  private filterClog = false;
  private mopTripped = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.filterDp = DP_CLEAN_BAR;
    this.coolerFouling = false;
    this.filterClog = false;
    this.mopTripped = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dtMin = ctx.dtMs / 60_000;
    const loadFrac = clamp(Math.max(0, ctx.getTag('GEN_MW_01')) / 600, 0, 1.1);
    const brgTemp = ctx.getTag('TRB_BRG_TEMP_01') || 75;

    // Nhiệt bể dầu: nền + ma sát theo tải + bám bộ làm mát.
    const reservoirTemp = RES_TEMP_BASE_C + RES_RISE_FULL_C * loadFrac + (this.coolerFouling ? COOLER_FOUL_C : 0);
    const coolerOut = reservoirTemp - COOLER_DROP_C;

    // Tắc lọc: ΔP tích luỹ khi sự cố; sạch giữ nền.
    if (this.filterClog) this.filterDp = clamp(this.filterDp + FILTER_CLOG_RATE * dtMin, DP_CLEAN_BAR, DP_MAX_BAR);
    else this.filterDp = DP_CLEAN_BAR;

    // Áp header: MOP nền, trừ tổn thất lọc; MOP trip → tụt; AOP/EOP tự khởi theo ngưỡng.
    const mopRun = !this.mopTripped && loadFrac > 0.01;
    const filterPenalty = K_DP_PRESS * Math.max(0, this.filterDp - DP_CLEAN_BAR); // MPa tụt do lọc tắc
    let header = (mopRun ? HEADER_NOM_MPA : HEADER_MOP_TRIP_MPA) - filterPenalty;
    const aopRun = header < AOP_START_MPA;
    if (aopRun) header = Math.max(header, HEADER_AOP_MPA - filterPenalty);
    const eopRun = header < EOP_START_MPA;
    if (eopRun) header = Math.max(header, HEADER_EOP_MPA);
    header = clamp(header, 0, 0.30);

    const brgMargin = BRG_TRIP_C - brgTemp;
    const healthy = header >= HEADER_HEALTHY_MIN_MPA && reservoirTemp <= RES_HEALTHY_MAX_C && this.filterDp < 1.0 && !eopRun ? 1 : 0;

    return {
      outputs: [
        { tagId: 'LUBE_RESERVOIR_TEMP_01', value: reservoirTemp, quality: 'Good' },
        { tagId: 'LUBE_COOLER_OUT_TEMP_01', value: coolerOut, quality: 'Good' },
        { tagId: 'LUBE_FILTER_DP_01', value: this.filterDp, quality: 'Good' },
        { tagId: 'LUBE_HEADER_PRESS_01', value: header, quality: 'Good' },
        { tagId: 'LUBE_MOP_RUN_01', value: mopRun ? 1 : 0, quality: 'Good' },
        { tagId: 'LUBE_AOP_RUN_01', value: aopRun ? 1 : 0, quality: 'Good' },
        { tagId: 'LUBE_EOP_RUN_01', value: eopRun ? 1 : 0, quality: 'Good' },
        { tagId: 'LUBE_BRG_MARGIN_01', value: brgMargin, quality: 'Good' },
        { tagId: 'LUBE_HEALTHY_01', value: healthy, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { filterDp: this.filterDp, coolerFouling: this.coolerFouling ? 1 : 0, filterClog: this.filterClog ? 1 : 0, mopTripped: this.mopTripped ? 1 : 0 } };
  }
  restore(s: ISimSnapshot): void {
    this.filterDp = s.state.filterDp ?? DP_CLEAN_BAR;
    this.coolerFouling = (s.state.coolerFouling ?? 0) > 0.5;
    this.filterClog = (s.state.filterClog ?? 0) > 0.5;
    this.mopTripped = (s.state.mopTripped ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'oil-cooler-fouling') this.coolerFouling = true;
    if (m.id === 'oil-filter-clog') this.filterClog = true;
    if (m.id === 'mop-trip') this.mopTripped = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'oil-cooler-fouling') this.coolerFouling = false;
    if (id === 'oil-filter-clog') this.filterClog = false;
    if (id === 'mop-trip') this.mopTripped = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

// Plugin thermal-power-600 — CombustionOptModel (ISimModel, doc 10 §6 — tối ưu cháy & bản đồ hiệu suất lò).
// CHỈ import @idtp/sdk. CHIỀU SÂU vật lý phía cháy: ĐƯỜNG CONG hiệu suất lò theo GIÓ THỪA (excess air). O₂
// thấp → cháy không hết (CO/carbon-in-ash LOI tăng, tổn thất chưa cháy); O₂ cao → tổn thất khói khô (dry gas
// loss) tăng. Có ĐIỂM TỐI ƯU (~3% O₂). Đọc BLR_FLUE_O2_01 + FG_STACK_TEMP_01 + BLR_COAL_FLOW_01 +
// PVM_MIN_FINENESS_01 (độ mịn nghiền kém → LOI tăng) → phân tích tổn thất + hiệu suất lò ƯỚC LƯỢNG.
//
// ADDITIVE — sinh tag CMB_* ĐỘC LẬP; KHÔNG đổi tag lõi (0 hồi quy). LƯU Ý: đây là hiệu suất LÒ HƠI (boiler,
// phía cháy ~88–90%) — CHẨN ĐOÁN riêng, TÁCH khỏi hiệu suất NET chu trình (M-06, 33%). Không đụng heat rate
// lõi. Tất định (không Math.random). Không giữ trạng thái động (thuần dẫn xuất) → snapshot rỗng. Malfunction:
// 'o2-trim-high' (gió thừa cao → dry gas loss) · 'o2-trim-low' (thiếu gió → LOI/unburned tăng).
//
// Neo Design Basis (Phụ lục A §2): lò than phun, O₂ khói ~3–3,5%, nhiệt khói ra ~120–130°C. O₂ tối ưu, hệ số
// tổn thất khói/chưa cháy, tương quan LOI–độ mịn/O₂, tổn thất bức xạ cố định = [GIẢ ĐỊNH].
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const O2_OPTIMUM_PCT = 3.0; // % — O₂ khói tối ưu (cân bằng dry gas vs unburned)
const AMB_TEMP_C = 30; // °C — nhiệt gió môi trường (nhiệt đới)
const K_DRY_LOSS = 0.018; // %/(°C·đơn vị EA) — hệ số tổn thất khói khô
const LOI_BASE_PCT = 4.0; // % — carbon-in-ash nền ở độ mịn/O₂ định mức
const FINE_REF_PCT = 75; // % — độ mịn tham chiếu (lọt sàng 200 mesh)
const K_LOI_FINE = 0.5; // %LOI / %độ-mịn thiếu
const K_LOI_O2 = 3.0; // %LOI / %O₂ thiếu (dưới tối ưu → cháy không hết)
const K_UNBURNED_LOSS = 0.35; // %tổn-thất / %LOI
const RADIATION_LOSS_PCT = 0.5; // % — tổn thất bức xạ + không đo được (cố định)
const MOISTURE_H2_LOSS_PCT = 6.0; // % — tổn thất ẩm nhiên liệu + nước từ đốt H₂ (cố định, đặc thù than)
const O2_TRIM_HIGH = 5.2; // % — O₂ khi trim hỏng mở lớn
const O2_TRIM_LOW = 1.4; // % — O₂ khi trim hỏng đóng nhỏ
const EFF_HEALTHY_MIN = 87; // % — ngưỡng hiệu suất lò lành mạnh

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class CombustionOptModel implements ISimModel {
  readonly id = 'thermal-combustion-opt';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'CMB_O2_MEAS_01', // % — O₂ khói (dùng để phân tích)
    'CMB_EXCESS_AIR_01', // % — gió thừa suy từ O₂
    'CMB_O2_OPTIMUM_01', // % — O₂ tối ưu
    'CMB_DRY_GAS_LOSS_01', // % — tổn thất khói khô
    'CMB_LOI_01', // % — carbon-in-ash (loss on ignition)
    'CMB_UNBURNED_LOSS_01', // % — tổn thất do cháy chưa hết
    'CMB_BOILER_EFF_EST_01', // % — hiệu suất lò ƯỚC LƯỢNG (phía cháy)
    'CMB_EFF_GAP_01', // % — độ hụt so hiệu suất đạt được tối ưu
    'CMB_HEALTHY_01', // 0/1 — cháy gần tối ưu, hiệu suất đủ
  ];

  private o2Override: number | null = null; // % — ép O₂ khi trim hỏng

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.o2Override = null;
  }

  private efficiencyAt(o2: number, stackT: number, fineness: number): { dry: number; loi: number; unburned: number; eff: number } {
    const excessAir = (o2 / Math.max(0.1, 21 - o2)) * 100; // % gió thừa từ O₂
    const dry = K_DRY_LOSS * (1 + excessAir / 100) * Math.max(0, stackT - AMB_TEMP_C);
    const loi = clamp(
      LOI_BASE_PCT + K_LOI_FINE * Math.max(0, FINE_REF_PCT - fineness) + K_LOI_O2 * Math.max(0, O2_OPTIMUM_PCT - o2),
      0,
      40,
    );
    const unburned = K_UNBURNED_LOSS * loi;
    const eff = 100 - dry - unburned - RADIATION_LOSS_PCT - MOISTURE_H2_LOSS_PCT;
    return { dry, loi, unburned, eff };
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const o2 = this.o2Override ?? Math.max(0, ctx.getTag('BLR_FLUE_O2_01'));
    const stackT = Math.max(AMB_TEMP_C, ctx.getTag('FG_STACK_TEMP_01') || 120);
    const finenessRaw = ctx.getTag('PVM_MIN_FINENESS_01');
    const fineness = finenessRaw > 0 ? finenessRaw : FINE_REF_PCT; // nếu chưa có (khởi động) → tham chiếu

    const at = this.efficiencyAt(o2, stackT, fineness);
    const excessAir = (o2 / Math.max(0.1, 21 - o2)) * 100;
    // Hiệu suất ĐẠT ĐƯỢC nếu chạy đúng O₂ tối ưu (cùng nhiệt khói/độ mịn) → độ hụt = tối ưu − hiện.
    const best = this.efficiencyAt(O2_OPTIMUM_PCT, stackT, fineness);
    const gap = Math.max(0, best.eff - at.eff);
    const healthy = at.eff >= EFF_HEALTHY_MIN && gap < 1.0 ? 1 : 0;

    return {
      outputs: [
        { tagId: 'CMB_O2_MEAS_01', value: o2, quality: 'Good' },
        { tagId: 'CMB_EXCESS_AIR_01', value: excessAir, quality: 'Good' },
        { tagId: 'CMB_O2_OPTIMUM_01', value: O2_OPTIMUM_PCT, quality: 'Good' },
        { tagId: 'CMB_DRY_GAS_LOSS_01', value: at.dry, quality: 'Good' },
        { tagId: 'CMB_LOI_01', value: at.loi, quality: 'Good' },
        { tagId: 'CMB_UNBURNED_LOSS_01', value: at.unburned, quality: 'Good' },
        { tagId: 'CMB_BOILER_EFF_EST_01', value: at.eff, quality: 'Good' },
        { tagId: 'CMB_EFF_GAP_01', value: gap, quality: 'Good' },
        { tagId: 'CMB_HEALTHY_01', value: healthy, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { o2Override: this.o2Override ?? -1 } };
  }
  restore(snapshot: ISimSnapshot): void {
    const v = snapshot.state.o2Override ?? -1;
    this.o2Override = v >= 0 ? v : null;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'o2-trim-high') this.o2Override = O2_TRIM_HIGH;
    if (m.id === 'o2-trim-low') this.o2Override = O2_TRIM_LOW;
  }
  clearMalfunction(id: string): void {
    if (id === 'o2-trim-high' || id === 'o2-trim-low') this.o2Override = null;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

// Plugin thermal-power-600 — PulverizerMillsModel (ISimModel, doc 10 §6 — máy nghiền than PER-MILL, chiều sâu).
// CHỈ import @idtp/sdk. CHIỀU SÂU vật lý phía nghiền: mô hình TỪNG máy nghiền A–F (5 chạy + 1 dự phòng), mỗi
// máy có TẢI · ĐỘ MỊN (% lọt sàng 200 mesh) · ΔP bát nghiền · trạng thái. Khi 1 máy TRIP, tổng than phân bổ
// lại cho các máy CÒN LẠI → tải leo (có thể quá tải) → độ mịn TỤT (grind thô → cháy kém). Khác model
// coal-handling (v1.25, tải TRUNG BÌNH): đây là PHÂN GIẢI từng máy + động học trip/redistribute.
//
// ADDITIVE — sinh tag PVM_* ĐỘC LẬP; KHÔNG đổi BLR_COAL_FLOW_01 / COAL_* (0 hồi quy). Tất định (không
// Math.random). Có TRẠNG THÁI (tập máy trip) → snapshot/restore. Malfunction: 'mill-a-trip'…'mill-e-trip'
// (trip 1 máy → máy còn lại gánh) · 'mill-classifier-wear' (mòn phân ly → độ mịn tụt toàn dàn).
//
// Neo Design Basis (Phụ lục A §2 — lò than phun): 6 máy nghiền bowl, mỗi máy ~60 t/h, 5 chạy + 1 dự phòng.
// Độ mịn định mức ~76 % lọt sàng 200 mesh ở ~85 % tải. Hệ số độ mịn/tải, ΔP bát, tỉ lệ gió sơ cấp = [GIẢ ĐỊNH].
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const MILL_IDS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
type MillId = (typeof MILL_IDS)[number];
const N_SERVICE_MAX = 5; // A–E có thể chạy; F dự phòng
const CAP_TPH = 60; // t/h — công suất 1 máy nghiền
const RATED_LOAD_PCT = 85; // % — tải định mức để đạt độ mịn danh định
const FINE_AT_RATED = 76; // % lọt sàng 200 mesh ở tải định mức
const K_FINE_PER_LOAD = 0.35; // %độ-mịn giảm / %tải vượt định mức (throughput cao → thô)
const FINE_FLOOR = 40;
const FINE_CEIL = 88;
const FINE_HEALTHY_MIN = 70; // % — dưới ngưỡng = grind thô, cháy kém
const CLASSIFIER_WEAR_FINE = 8; // % — mòn phân ly làm tụt độ mịn
const DP_RATED_KPA = 6; // kPa — ΔP bát nghiền ở tải định mức
const PA_RATIO = 1.8; // t/h gió sơ cấp / t/h than (mang bột than)
const LOAD_HEALTHY_MAX = 100; // % — trên 100 % là quá tải máy nghiền

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class PulverizerMillsModel implements ISimModel {
  readonly id = 'thermal-pulverizer-mills';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    // Per-mill: tải (%) · độ mịn (%) · trạng thái (0 dừng / 1 chạy / 2 trip).
    'PVM_A_LOAD_01', 'PVM_A_FINENESS_01', 'PVM_A_STATUS_01',
    'PVM_B_LOAD_01', 'PVM_B_FINENESS_01', 'PVM_B_STATUS_01',
    'PVM_C_LOAD_01', 'PVM_C_FINENESS_01', 'PVM_C_STATUS_01',
    'PVM_D_LOAD_01', 'PVM_D_FINENESS_01', 'PVM_D_STATUS_01',
    'PVM_E_LOAD_01', 'PVM_E_FINENESS_01', 'PVM_E_STATUS_01',
    'PVM_F_LOAD_01', 'PVM_F_FINENESS_01', 'PVM_F_STATUS_01',
    // Aggregate.
    'PVM_RUNNING_01', // — số máy đang nghiền
    'PVM_TRIPPED_01', // — số máy trip
    'PVM_MAX_LOAD_01', // % — tải máy cao nhất (đỉnh quá tải)
    'PVM_MIN_FINENESS_01', // % — độ mịn máy kém nhất
    'PVM_DP_AVG_01', // kPa — ΔP bát nghiền trung bình
    'PVM_PA_TOTAL_01', // t/h — tổng gió sơ cấp mang bột than
    'PVM_HEALTHY_01', // 0/1 — không trip, không quá tải, độ mịn đủ
  ];

  private tripped = new Set<MillId>();
  private classifierWear = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.tripped = new Set<MillId>();
    this.classifierWear = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const coal = Math.max(0, ctx.getTag('BLR_COAL_FLOW_01')); // t/h tiêu thụ (chỉ đọc)
    const firing = coal > 1;

    // Số máy CẦN đưa vào vận hành (A–E; F dự phòng, chỉ chạy khi được lệnh — ở đây giữ dự phòng).
    const needed = firing ? clamp(Math.ceil(coal / CAP_TPH), 1, N_SERVICE_MAX) : 0;
    const inService: MillId[] = MILL_IDS.slice(0, needed) as MillId[];
    const active = inService.filter((m) => !this.tripped.has(m)); // máy còn nghiền sau khi trừ trip

    // Than phân bổ lại cho các máy CÒN LẠI (máy trip mất phần → máy khác gánh → tải leo).
    const coalPerMill = active.length > 0 ? coal / active.length : 0;
    const loadPct = (coalPerMill / CAP_TPH) * 100;
    const fineness = clamp(
      FINE_AT_RATED - K_FINE_PER_LOAD * (loadPct - RATED_LOAD_PCT) - (this.classifierWear ? CLASSIFIER_WEAR_FINE : 0),
      FINE_FLOOR,
      FINE_CEIL,
    );
    const dpKpa = DP_RATED_KPA * (loadPct / RATED_LOAD_PCT) * (loadPct / RATED_LOAD_PCT); // ΔP ∝ tải²
    const paTotal = coal * PA_RATIO;

    const outputs: Array<{ tagId: TagId; value: number; quality: 'Good' }> = [];
    for (const m of MILL_IDS) {
      const isActive = active.includes(m);
      const isTripped = this.tripped.has(m) && inService.includes(m);
      const status = isTripped ? 2 : isActive ? 1 : 0;
      outputs.push({ tagId: `PVM_${m}_LOAD_01` as TagId, value: isActive ? loadPct : 0, quality: 'Good' });
      outputs.push({ tagId: `PVM_${m}_FINENESS_01` as TagId, value: isActive ? fineness : 0, quality: 'Good' });
      outputs.push({ tagId: `PVM_${m}_STATUS_01` as TagId, value: status, quality: 'Good' });
    }

    const trippedInService = inService.filter((m) => this.tripped.has(m)).length;
    const maxLoad = active.length > 0 ? loadPct : 0;
    const minFine = active.length > 0 ? fineness : 0;
    const healthy = active.length > 0 && trippedInService === 0 && maxLoad <= LOAD_HEALTHY_MAX && minFine >= FINE_HEALTHY_MIN ? 1 : 0;

    outputs.push(
      { tagId: 'PVM_RUNNING_01', value: active.length, quality: 'Good' },
      { tagId: 'PVM_TRIPPED_01', value: trippedInService, quality: 'Good' },
      { tagId: 'PVM_MAX_LOAD_01', value: maxLoad, quality: 'Good' },
      { tagId: 'PVM_MIN_FINENESS_01', value: minFine, quality: 'Good' },
      { tagId: 'PVM_DP_AVG_01', value: active.length > 0 ? dpKpa : 0, quality: 'Good' },
      { tagId: 'PVM_PA_TOTAL_01', value: paTotal, quality: 'Good' },
      { tagId: 'PVM_HEALTHY_01', value: firing ? healthy : 1, quality: 'Good' },
    );

    return { outputs };
  }

  snapshot(): ISimSnapshot {
    // state chỉ nhận số → mã hoá tập máy trip thành cờ 0/1 mỗi máy.
    const state: Record<string, number> = { classifierWear: this.classifierWear ? 1 : 0 };
    for (const m of MILL_IDS) state[`trip${m}`] = this.tripped.has(m) ? 1 : 0;
    return { state };
  }
  restore(snapshot: ISimSnapshot): void {
    this.tripped = new Set<MillId>();
    for (const m of MILL_IDS) if ((snapshot.state[`trip${m}`] ?? 0) > 0.5) this.tripped.add(m);
    this.classifierWear = (snapshot.state.classifierWear ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    const letter = /^mill-([a-e])-trip$/.exec(m.id)?.[1];
    if (letter) this.tripped.add(letter.toUpperCase() as MillId);
    if (m.id === 'mill-classifier-wear') this.classifierWear = true;
  }
  clearMalfunction(id: string): void {
    const letter = /^mill-([a-e])-trip$/.exec(id)?.[1];
    if (letter) this.tripped.delete(letter.toUpperCase() as MillId);
    if (id === 'mill-classifier-wear') this.classifierWear = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

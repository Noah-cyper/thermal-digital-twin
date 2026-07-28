// Plugin thermal-power-600 — CoalHandlingModel (ISimModel, doc 10 §6 — cung cấp than: bunker · feeder ·
// mill · yard). CHỈ import @idtp/sdk. CHIỀU SÂU vật lý bổ sung (v1.25), chạy CẠNH boiler: đọc lưu lượng
// than tiêu thụ tươi → phía CẤP NHIÊN LIỆU: mức bunker (tích phân theo tiêu thụ vs băng tải), số mill
// chạy + tải mill, suất feeder, dự trữ yard. ADDITIVE — không đổi BLR_COAL_FLOW_01 (0 hồi quy). Tất
// định (không Math.random). Có TRẠNG THÁI (mức bunker) — snapshot/restore cho OTS.
//
// Neo Design Basis (Phụ lục A): máy nghiền 6 × 60 t/h (5 chạy + 1 dự phòng) · đường than yard →
// stacker/reclaimer → băng tải → crusher → bunker → feeder → mill. Sức chứa bunker, suất băng tải,
// ngưỡng điều khiển refill, dự trữ yard = [GIẢ ĐỊNH] (GĐ-72).
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

/* ── Design Basis (Phụ lục A) ── */
const MILL_CAP_TPH = 60; // 1 máy nghiền
const MILLS_TOTAL = 6; // 5 chạy + 1 dự phòng

/* ── [GIẢ ĐỊNH] hiệu chỉnh (GĐ-72) ── */
const BUNKER_CAP_T = 2400; // sức chứa bunker (~8 h ở tải danh định)
const CONVEYOR_RATE_TPH = 800; // suất băng tải cấp bunker
const REFILL_LOW_PCT = 60; // < ngưỡng → bật băng tải
const REFILL_HIGH_PCT = 90; // > ngưỡng → tắt băng tải (trễ chống dao động)
const YARD_STOCK_T = 180_000; // dự trữ yard (~26 ngày ở tải danh định)

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class CoalHandlingModel implements ISimModel {
  readonly id = 'thermal-coal-handling';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'COAL_CONSUMPTION_01', // t/h — tiêu thụ than (= BLR_COAL_FLOW)
    'COAL_BUNKER_LEVEL_01', // % — mức bunker
    'COAL_CONVEYOR_FEED_01', // t/h — băng tải cấp bunker
    'COAL_MILLS_RUNNING_01', // — số máy nghiền chạy
    'COAL_MILL_LOADING_01', // % — tải trung bình mỗi máy nghiền
    'COAL_FEEDER_RATE_01', // t/h — suất feeder mỗi máy nghiền
    'COAL_YARD_DAYS_01', // ngày — dự trữ yard ở tiêu thụ hiện tại
  ];

  private bunkerPct = 75;
  private conveyorOn = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.bunkerPct = 75;
    this.conveyorOn = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dtH = ctx.dtMs / 3_600_000; // giờ
    const coal = Math.max(0, ctx.getTag('BLR_COAL_FLOW_01')); // t/h tiêu thụ
    const firing = coal > 1;

    // Điều khiển băng tải theo trễ (hysteresis) giữ bunker trong dải.
    if (this.bunkerPct < REFILL_LOW_PCT) this.conveyorOn = true;
    else if (this.bunkerPct > REFILL_HIGH_PCT) this.conveyorOn = false;
    const feed = this.conveyorOn ? CONVEYOR_RATE_TPH : 0;

    // Bunker = tích phân (vào − ra) / sức chứa.
    this.bunkerPct = clamp(this.bunkerPct + ((feed - coal) / BUNKER_CAP_T) * 100 * dtH, 0, 100);

    // Máy nghiền: số chạy đủ tải (mỗi máy ≤ 60 t/h); tải & feeder trung bình.
    const running = firing ? clamp(Math.ceil(coal / MILL_CAP_TPH), 1, MILLS_TOTAL) : 0;
    const millLoading = running > 0 ? (coal / running / MILL_CAP_TPH) * 100 : 0;
    const feederRate = running > 0 ? coal / running : 0;

    // Dự trữ yard tính theo ngày ở tiêu thụ hiện tại.
    const yardDays = firing ? YARD_STOCK_T / (coal * 24) : 0;

    return {
      outputs: [
        { tagId: 'COAL_CONSUMPTION_01', value: coal, quality: 'Good' },
        { tagId: 'COAL_BUNKER_LEVEL_01', value: this.bunkerPct, quality: 'Good' },
        { tagId: 'COAL_CONVEYOR_FEED_01', value: feed, quality: 'Good' },
        { tagId: 'COAL_MILLS_RUNNING_01', value: running, quality: 'Good' },
        { tagId: 'COAL_MILL_LOADING_01', value: millLoading, quality: 'Good' },
        { tagId: 'COAL_FEEDER_RATE_01', value: feederRate, quality: 'Good' },
        { tagId: 'COAL_YARD_DAYS_01', value: yardDays, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { bunkerPct: this.bunkerPct, conveyorOn: this.conveyorOn ? 1 : 0 } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.bunkerPct = snapshot.state.bunkerPct ?? 75;
    this.conveyorOn = (snapshot.state.conveyorOn ?? 0) > 0.5;
  }
  injectMalfunction(_m: IMalfunction): void {
    // model không có malfunction riêng ở v1.25
  }
  clearMalfunction(_id: string): void {
    // không giữ trạng thái malfunction
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

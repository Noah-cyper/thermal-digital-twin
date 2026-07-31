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
/* ── Nhiệt ra máy nghiền + áp header gió sơ cấp (mill outlet temp / PA header) — GĐ-85 ── */
const T_TEMPER_AIR_C = 30; // gió lạnh tempering (môi trường)
const T_HOT_PA_FALLBACK_C = 271; // gió nóng PA từ air heater ở đầy tải (fallback khi tag vắng — standalone)
const K_COAL_DRY_COOL_C = 40; // °C — làm nguội do bốc ẩm than theo tải mill
const MILL_TEMP_MIN_C = 30; // sàn nhiệt ra mill (gió lạnh)
const MILL_TEMP_MAX_C = 120; // trần an toàn (quá nhiệt → nguy cơ cháy bột than)
const TAU_MILL_S = 45; // quán tính nhiệt máy nghiền (kim loại + tồn than) — làm mượt loop nhiệt
const K_PA_VANE_KPA = 18; // kPa toàn hành trình van hướng quạt gió sơ cấp (PA)
const K_PA_RESIST_KPA = 4; // kPa sụt áp trở lực mill/vòi đốt theo tải

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
    // Chiều sâu SCADA: tải TỪNG máy nghiền A–F (6 máy). n máy đầu mang tải đều (= tải trung bình), số
    // còn lại DỰ PHÒNG ở 0 % — dùng chính `running`/`millLoading` đã tính (KHÔNG bịa, không thêm trạng thái).
    'COAL_MILL_A_LOAD_01',
    'COAL_MILL_B_LOAD_01',
    'COAL_MILL_C_LOAD_01',
    'COAL_MILL_D_LOAD_01',
    'COAL_MILL_E_LOAD_01',
    'COAL_MILL_F_LOAD_01',
    'COAL_MILL_OUT_TEMP_01', // °C — nhiệt ra máy nghiền (van gió nóng/tempering giữ ~70 °C)
    'COAL_PA_HEADER_PRESS_01', // kPa — áp header gió sơ cấp (quạt PA giữ ~9 kPa)
  ];

  private bunkerPct = 75;
  private conveyorOn = false;
  private millTemp = 70; // °C — nhiệt ra máy nghiền (quán tính nhiệt → loop nhiệt ổn định)

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.bunkerPct = 75;
    this.conveyorOn = false;
    this.millTemp = 70;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dtH = ctx.dtMs / 3_600_000; // giờ
    const dt = ctx.dtMs / 1000; // giây
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

    // Tải từng máy nghiền A–F: `running` máy đầu ở tải trung bình, phần còn lại dự phòng ở 0 %.
    const millIds = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

    // Nhiệt ra máy nghiền: trộn gió NÓNG PA (từ air heater AH_AIR_OUT_TEMP_01) + gió LẠNH tempering, trừ
    // làm nguội do bốc ẩm than (∝ tải mill). Van gió nóng COAL_HOT_AIR_DMPR_01 (loop 'mill-outlet-temp',
    // direct: nhiệt thấp → mở thêm gió nóng) giữ ~70 °C sấy bột than mà không quá nhiệt. Không cháy → gió lạnh.
    const hotDmpr = clamp(ctx.getTag('COAL_HOT_AIR_DMPR_01'), 0, 100);
    const tHotPa = ctx.getTag('AH_AIR_OUT_TEMP_01') > 1 ? ctx.getTag('AH_AIR_OUT_TEMP_01') : T_HOT_PA_FALLBACK_C;
    const millTempTarget = firing
      ? clamp(T_TEMPER_AIR_C + (tHotPa - T_TEMPER_AIR_C) * (hotDmpr / 100) - K_COAL_DRY_COOL_C * (millLoading / 100), MILL_TEMP_MIN_C, MILL_TEMP_MAX_C)
      : T_TEMPER_AIR_C;
    // Quán tính nhiệt máy nghiền (kim loại + tồn than): nhiệt ra BÁM mục tiêu trộn với trễ TAU_MILL —
    // làm mượt vòng 'mill-outlet-temp' (mục tiêu trộn tức thời có gain lớn, cần quán tính cho ổn định).
    this.millTemp += (millTempTarget - this.millTemp) * (dt / TAU_MILL_S);

    // Áp header gió sơ cấp (PA): quạt PA (van hướng COAL_PA_FAN_VANE_01) tạo áp; trở lực mill/vòi đốt sụt
    // áp theo tải. Loop 'pa-header-pressure' (direct) giữ ~9 kPa vận chuyển bột than tới vòi đốt.
    const paVane = clamp(ctx.getTag('COAL_PA_FAN_VANE_01'), 0, 100);
    const paHeader = firing ? Math.max(0, (paVane / 100) * K_PA_VANE_KPA - K_PA_RESIST_KPA * (millLoading / 100)) : 0;

    return {
      outputs: [
        { tagId: 'COAL_CONSUMPTION_01', value: coal, quality: 'Good' },
        { tagId: 'COAL_BUNKER_LEVEL_01', value: this.bunkerPct, quality: 'Good' },
        { tagId: 'COAL_CONVEYOR_FEED_01', value: feed, quality: 'Good' },
        { tagId: 'COAL_MILLS_RUNNING_01', value: running, quality: 'Good' },
        { tagId: 'COAL_MILL_LOADING_01', value: millLoading, quality: 'Good' },
        { tagId: 'COAL_FEEDER_RATE_01', value: feederRate, quality: 'Good' },
        { tagId: 'COAL_YARD_DAYS_01', value: yardDays, quality: 'Good' },
        ...millIds.map((_L, i) => ({ tagId: `COAL_MILL_${millIds[i]}_LOAD_01` as TagId, value: i < running ? millLoading : 0, quality: 'Good' as const })),
        { tagId: 'COAL_MILL_OUT_TEMP_01', value: this.millTemp, quality: 'Good' },
        { tagId: 'COAL_PA_HEADER_PRESS_01', value: paHeader, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { bunkerPct: this.bunkerPct, conveyorOn: this.conveyorOn ? 1 : 0, millTemp: this.millTemp } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.bunkerPct = snapshot.state.bunkerPct ?? 75;
    this.conveyorOn = (snapshot.state.conveyorOn ?? 0) > 0.5;
    this.millTemp = snapshot.state.millTemp ?? 70;
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

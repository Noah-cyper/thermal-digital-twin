// Plugin thermal-power-600 — SootBlowerModel (ISimModel, doc 10 §10 BOP — Thổi bụi bề mặt truyền nhiệt).
// CHỈ import @idtp/sdk. Hệ Balance-of-Plant §10: tro/xỉ bám trên bề mặt truyền nhiệt (vách buồng lửa ·
// bộ quá nhiệt/tái nhiệt · bộ hâm nước · bộ sấy gió) → giảm truyền nhiệt (khói ra NÓNG hơn, hiệu suất lò
// giảm). Máy thổi bụi (soot blower rút được / kiểu vách) định kỳ phun hơi cao áp làm sạch từng vùng theo
// TRÌNH TỰ, tiêu tốn một lượng hơi ký sinh. Mô hình răng cưa TẤT ĐỊNH: chỉ số bám tăng ∝ than-tro, tới
// ngưỡng thì khởi động một chu trình thổi quét lần lượt các vùng → hạ chỉ số bám về mức dư.
//
// ADDITIVE — sinh tag SB_* độc lập; đọc BLR_COAL_FLOW_01 suy tốc độ bám. Tất định (không Math.random). Có
// TRẠNG THÁI (chỉ số bám + tiến trình chu trình thổi) → snapshot/restore cho OTS. KHÔNG ghi đè tag hệ chính:
// SB_GAS_EXIT_TEMP_DELTA_01 chỉ là ƯỚC LƯỢNG read-only (không tác động FlueGasAirModel) → 0 hồi quy.
//
// Neo Design Basis (Phụ lục A): than bituminous tro 15% (nguồn tro bám). Tốc độ bám, ngưỡng khởi động chu
// trình, số máy thổi/vùng, thời lượng thổi mỗi vùng, suất hơi thổi, hệ số bám→nhiệt khói = [GIẢ ĐỊNH] GĐ-95.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const COAL_REF_TPH = 211; // than tại điểm vận hành (~448 MW) — chuẩn hoá tốc độ bám
const FOUL_RATE_PCT_PER_H = 6; // %/giờ — tốc độ tích tụ bám ở than chuẩn (bề mặt sạch bám nhanh hơn thực tế để quan sát)
const CYCLE_TRIGGER_PCT = 45; // % — chỉ số bám vượt ngưỡng → khởi động chu trình thổi
const FOUL_RESIDUAL_PCT = 5; // % — mức bám dư sau khi thổi sạch (không về 0 tuyệt đối)
const CLEAN_RATE_PCT_PER_MIN = 2.2; // %/phút — tốc độ hạ chỉ số bám khi một vùng đang thổi
const ZONE_DURATION_MIN = 6; // phút — thời lượng thổi mỗi vùng
const STEAM_PER_BLOW_TPH = 12; // t/h — suất hơi thổi khi một vùng đang hoạt động (ký sinh)
const STEAM_HEADER_BARG = 30; // barg — áp header hơi thổi bụi (~3 MPa, trích hơi nguội)
const STEAM_HEADER_DROP_BARG = 2.5; // barg — sụt áp header khi đang thổi
const FOUL_TO_GASTEMP = 0.9; // °C/% — ước lượng độ tăng nhiệt khói ra theo chỉ số bám (read-only)

// 4 vùng máy thổi bụi quét lần lượt trong một chu trình (số máy thổi/vùng theo bố trí điển hình lò 600 MW).
const ZONE_BLOWERS: ReadonlyArray<number> = [24, 16, 8, 2]; // vách buồng lửa · SH/RH · bộ hâm · bộ sấy gió
const N_ZONES = ZONE_BLOWERS.length;
const TOTAL_BLOWERS = ZONE_BLOWERS.reduce((a, b) => a + b, 0); // 50

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class SootBlowerModel implements ISimModel {
  readonly id = 'thermal-soot-blower';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'SB_FOULING_INDEX_01', // % — chỉ số bám bề mặt truyền nhiệt (0 = sạch)
    'SB_CLEANLINESS_01', // % — độ sạch hiệu dụng (100 − bám)
    'SB_CYCLE_ACTIVE_01', // 0/1 — chu trình thổi đang chạy
    'SB_ZONE_ACTIVE_01', // 0..4 — vùng đang thổi (0 = không thổi)
    'SB_STEAM_FLOW_01', // t/h — lưu lượng hơi thổi bụi (0 khi nghỉ)
    'SB_STEAM_HEADER_PRESS_01', // barg — áp header hơi thổi bụi
    'SB_BLOWERS_STROKED_01', // — số máy thổi đã stroke trong chu trình hiện tại
    'SB_TIME_SINCE_CYCLE_01', // phút — thời gian kể từ chu trình thổi hoàn tất gần nhất
    'SB_GAS_EXIT_TEMP_DELTA_01', // °C — ước lượng độ tăng nhiệt khói ra do bám (read-only)
  ];

  private fouling = 20; // %
  private blowing = false;
  private zone = 0; // 0 = nghỉ; 1..N_ZONES = vùng đang thổi
  private zoneTimerMin = 0;
  private blowersStroked = 0;
  private sinceCycleMin = 0;
  private faulted = false; // malfunction: máy thổi kẹt/van hỏng → thổi không làm sạch

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.fouling = 20;
    this.blowing = false;
    this.zone = 0;
    this.zoneTimerMin = 0;
    this.blowersStroked = 0;
    this.sinceCycleMin = 0;
    this.faulted = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dtH = ctx.dtMs / 3_600_000; // giờ
    const dtMin = ctx.dtMs / 60_000; // phút
    const coal = Math.max(0, ctx.getTag('BLR_COAL_FLOW_01'));
    const coalFrac = coal / COAL_REF_TPH; // >0 khi đang đốt

    if (this.blowing) {
      // Đang trong chu trình thổi: hạ chỉ số bám (nếu không lỗi), đếm thời lượng vùng, quét sang vùng kế.
      if (!this.faulted) this.fouling = Math.max(FOUL_RESIDUAL_PCT, this.fouling - CLEAN_RATE_PCT_PER_MIN * dtMin);
      // Vẫn có bám mới sinh trong lúc thổi (than tiếp tục đốt) — cộng thêm để cân bằng thực tế.
      this.fouling = clamp(this.fouling + FOUL_RATE_PCT_PER_H * coalFrac * dtH, 0, 100);
      this.zoneTimerMin += dtMin;
      while (this.zoneTimerMin >= ZONE_DURATION_MIN && this.zone <= N_ZONES) {
        this.zoneTimerMin -= ZONE_DURATION_MIN;
        this.blowersStroked += ZONE_BLOWERS[this.zone - 1] ?? 0; // hoàn tất vùng hiện tại
        this.zone += 1;
      }
      if (this.zone > N_ZONES) {
        // Chu trình hoàn tất → về nghỉ, đặt lại đồng hồ kể từ chu trình.
        this.blowing = false;
        this.zone = 0;
        this.zoneTimerMin = 0;
        this.sinceCycleMin = 0;
      }
    } else {
      // Nghỉ: bám tích tụ ∝ than-tro; tới ngưỡng và đang đốt → khởi động chu trình thổi.
      this.fouling = clamp(this.fouling + FOUL_RATE_PCT_PER_H * coalFrac * dtH, 0, 100);
      this.sinceCycleMin += dtMin;
      if (this.fouling >= CYCLE_TRIGGER_PCT && coal > 0) {
        this.blowing = true;
        this.zone = 1;
        this.zoneTimerMin = 0;
        this.blowersStroked = 0;
      }
    }

    const zoneActive = this.blowing ? this.zone : 0;
    const steamFlow = zoneActive > 0 ? STEAM_PER_BLOW_TPH : 0;
    const headerPress = zoneActive > 0 ? STEAM_HEADER_BARG - STEAM_HEADER_DROP_BARG : STEAM_HEADER_BARG;
    const cleanliness = 100 - this.fouling;
    const gasTempDelta = this.fouling * FOUL_TO_GASTEMP;

    return {
      outputs: [
        { tagId: 'SB_FOULING_INDEX_01', value: this.fouling, quality: 'Good' },
        { tagId: 'SB_CLEANLINESS_01', value: cleanliness, quality: 'Good' },
        { tagId: 'SB_CYCLE_ACTIVE_01', value: this.blowing ? 1 : 0, quality: 'Good' },
        { tagId: 'SB_ZONE_ACTIVE_01', value: zoneActive, quality: 'Good' },
        { tagId: 'SB_STEAM_FLOW_01', value: steamFlow, quality: 'Good' },
        { tagId: 'SB_STEAM_HEADER_PRESS_01', value: headerPress, quality: 'Good' },
        { tagId: 'SB_BLOWERS_STROKED_01', value: this.blowersStroked, quality: 'Good' },
        { tagId: 'SB_TIME_SINCE_CYCLE_01', value: this.sinceCycleMin, quality: 'Good' },
        { tagId: 'SB_GAS_EXIT_TEMP_DELTA_01', value: gasTempDelta, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return {
      state: {
        fouling: this.fouling,
        blowing: this.blowing ? 1 : 0,
        zone: this.zone,
        zoneTimerMin: this.zoneTimerMin,
        blowersStroked: this.blowersStroked,
        sinceCycleMin: this.sinceCycleMin,
        faulted: this.faulted ? 1 : 0,
      },
    };
  }
  restore(snapshot: ISimSnapshot): void {
    this.fouling = snapshot.state.fouling ?? 20;
    this.blowing = (snapshot.state.blowing ?? 0) > 0.5;
    this.zone = snapshot.state.zone ?? 0;
    this.zoneTimerMin = snapshot.state.zoneTimerMin ?? 0;
    this.blowersStroked = snapshot.state.blowersStroked ?? 0;
    this.sinceCycleMin = snapshot.state.sinceCycleMin ?? 0;
    this.faulted = (snapshot.state.faulted ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    // Máy thổi kẹt / van hơi hỏng: chu trình vẫn quét nhưng KHÔNG làm sạch → chỉ số bám leo thang (OTS).
    if (m.id === 'sootblower-fault') this.faulted = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'sootblower-fault') this.faulted = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }

  /** Tổng số máy thổi bụi trong hệ (hằng khai báo, phục vụ kiểm thử). */
  static get totalBlowers(): number {
    return TOTAL_BLOWERS;
  }
}

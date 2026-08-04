// Plugin thermal-power-600 — EmergencyPowerModel (ISimModel, doc 10 §7 BOP — Nguồn điện khẩn cấp).
// CHỈ import @idtp/sdk. Hai hệ nguồn dự phòng an toàn:
//  (1) DIESEL GENERATOR khẩn cấp (EDG): thường DỪNG-SẴN SÀNG (bồn dầu đầy, khí khởi động đủ); tự KHỞI ĐỘNG
//      + mang tải khi MẤT ĐIỆN tự dùng (station blackout) → cấp AC khẩn cho tải an toàn.
//  (2) UPS + ẮC-QUY DC 220/110 V: cấp LIÊN TỤC tải điều khiển/bảo vệ tối quan trọng. Bình thường nạp nổi
//      (float, SOC ~100%, lấy điện lưới); khi mất điện → chuyển sang ẮC-QUY (SOC giảm dần theo autonomy).
//
// ADDITIVE — sinh tag EDG_*/UPS_* độc lập; đọc GEN_MW_01 (nhà máy đang phát → lưới tự dùng còn) để suy sẵn
// sàng. Tất định (không Math.random). Có TRẠNG THÁI (SOC ắc-quy · dầu · latch EDG) → snapshot/restore.
// Malfunction 'station-blackout' → EDG chạy + UPS xả ắc-quy (OTS). Ở vận hành bình thường EDG dừng, UPS float.
//
// Neo Design Basis (Phụ lục A §3.3): DC 220/110 V. Suất EDG, dung lượng dầu/khí khởi động, autonomy ắc-quy,
// tốc độ xả/nạp = [GIẢ ĐỊNH] GĐ-100.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const EDG_LOAD_PCT = 68; // % suất EDG khi mang tải khẩn (tải an toàn ~ cố định)
const FUEL_BURN_PCT_PER_H = 8; // %/giờ tiêu dầu bồn ngày khi EDG chạy
const SOC_DISCHARGE_PCT_PER_H = 25; // %/giờ xả ắc-quy khi mất điện (autonomy ~ vài giờ)
const SOC_RECHARGE_PCT_PER_H = 40; // %/giờ nạp lại khi có điện
const START_AIR_RUN_BARG = 24; // barg khí khởi động sau khi đã khởi động
const START_AIR_READY_BARG = 28; // barg khí khởi động khi sẵn sàng
const UPS_LOAD_PCT = 42; // % tải UPS (tải điều khiển/bảo vệ tối quan trọng ~ cố định)

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class EmergencyPowerModel implements ISimModel {
  readonly id = 'thermal-emergency-power';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'EDG_RUNNING_01', // 0/1 — máy phát diesel đang chạy
    'EDG_LOAD_01', // % — tải EDG
    'EDG_FUEL_TANK_01', // % — mức dầu bồn ngày
    'EDG_READY_01', // 0/1 — EDG sẵn sàng tự khởi động
    'EDG_START_AIR_01', // barg — bình khí khởi động
    'UPS_DC220_VOLT_01', // V — thanh cái DC 220 V
    'UPS_DC110_VOLT_01', // V — thanh cái DC 110 V
    'UPS_BATT_SOC_01', // % — dung lượng còn lại ắc-quy
    'UPS_AC_OUT_01', // V — điện ra bộ nghịch lưu UPS (AC tối quan trọng)
    'UPS_LOAD_01', // % — tải UPS
    'UPS_ON_BATTERY_01', // 0/1 — UPS đang chạy ẮC-QUY (mất điện) vs nạp nổi
  ];

  private soc = 100; // %
  private fuel = 95; // %
  private edgRunning = false;
  private blackout = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.soc = 100;
    this.fuel = 95;
    this.edgRunning = false;
    this.blackout = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dtH = ctx.dtMs / 3_600_000; // giờ
    // Lưới tự dùng còn khi nhà máy đang phát (MW > 10) VÀ không bị blackout (malfunction).
    const auxPowerAvailable = Math.max(0, ctx.getTag('GEN_MW_01')) > 10 && !this.blackout;

    if (auxPowerAvailable) {
      // Bình thường: EDG dừng-sẵn sàng; UPS nạp nổi từ lưới → SOC hồi về 100%; dầu bồn ngày được bù đầy.
      this.edgRunning = false;
      this.soc = clamp(this.soc + SOC_RECHARGE_PCT_PER_H * dtH, 0, 100);
      this.fuel = clamp(this.fuel + 2 * dtH, 0, 95);
    } else {
      // Mất điện tự dùng: EDG tự khởi động + mang tải; UPS chuyển sang ắc-quy → SOC & dầu giảm dần.
      this.edgRunning = true;
      this.soc = clamp(this.soc - SOC_DISCHARGE_PCT_PER_H * dtH, 0, 100);
      this.fuel = clamp(this.fuel - FUEL_BURN_PCT_PER_H * dtH, 0, 100);
    }

    const onBattery = !auxPowerAvailable;
    // Điện áp DC sụt theo SOC (đặc tuyến xả ắc-quy): đầy 220/110 V, cạn tụt ~10%.
    const dc220 = 220 - (100 - this.soc) * 0.2;
    const dc110 = 110 - (100 - this.soc) * 0.1;
    const acOut = onBattery ? 228 : 230;

    return {
      outputs: [
        { tagId: 'EDG_RUNNING_01', value: this.edgRunning ? 1 : 0, quality: 'Good' },
        { tagId: 'EDG_LOAD_01', value: this.edgRunning ? EDG_LOAD_PCT : 0, quality: 'Good' },
        { tagId: 'EDG_FUEL_TANK_01', value: this.fuel, quality: 'Good' },
        { tagId: 'EDG_READY_01', value: !this.edgRunning && this.fuel > 10 ? 1 : 0, quality: 'Good' },
        { tagId: 'EDG_START_AIR_01', value: this.edgRunning ? START_AIR_RUN_BARG : START_AIR_READY_BARG, quality: 'Good' },
        { tagId: 'UPS_DC220_VOLT_01', value: dc220, quality: 'Good' },
        { tagId: 'UPS_DC110_VOLT_01', value: dc110, quality: 'Good' },
        { tagId: 'UPS_BATT_SOC_01', value: this.soc, quality: 'Good' },
        { tagId: 'UPS_AC_OUT_01', value: acOut, quality: 'Good' },
        { tagId: 'UPS_LOAD_01', value: UPS_LOAD_PCT, quality: 'Good' },
        { tagId: 'UPS_ON_BATTERY_01', value: onBattery ? 1 : 0, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { soc: this.soc, fuel: this.fuel, edgRunning: this.edgRunning ? 1 : 0, blackout: this.blackout ? 1 : 0 } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.soc = snapshot.state.soc ?? 100;
    this.fuel = snapshot.state.fuel ?? 95;
    this.edgRunning = (snapshot.state.edgRunning ?? 0) > 0.5;
    this.blackout = (snapshot.state.blackout ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    // Mất điện tự dùng (station blackout): kích EDG khởi động + UPS xả ắc-quy (OTS).
    if (m.id === 'station-blackout') this.blackout = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'station-blackout') this.blackout = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

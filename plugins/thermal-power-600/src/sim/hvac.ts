// Plugin thermal-power-600 — HvacModel (ISimModel, doc 10 §10 BOP — Điều hoà & thông gió nhà máy).
// CHỈ import @idtp/sdk. Hệ HVAC: điều hoà chính xác phòng điều khiển (nhiệt/ẩm), làm mát phòng tủ điện/
// switchgear (tải nhiệt thiết bị), thông gió gian tuabin. Nước lạnh (chilled water) từ chiller. Bộ lọc gió
// tăng ΔP theo bám bụi. Đọc tải nhà máy (GEN_MW → tải nhiệt switchgear) để suy nhiệt phòng tủ điện.
//
// ADDITIVE — sinh tag HVAC_* độc lập. Tất định. Có TRẠNG THÁI (nhiệt phòng điều khiển có quán tính) →
// snapshot/restore. Malfunction 'hvac-chiller-trip' → mất làm mát → nhiệt phòng điều khiển tăng (OTS).
// Nhiệt/ẩm đích, tải chiller, ΔP lọc = [GIẢ ĐỊNH] GĐ-102.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const CR_TEMP_SP_C = 23; // °C — nhiệt phòng điều khiển đích
const CR_TEMP_FAIL_C = 33; // °C — nhiệt phòng điều khiển khi mất làm mát
const TAU_CR_S = 120; // s — quán tính nhiệt phòng điều khiển
const CHW_SUPPLY_C = 7; // °C — nước lạnh cấp chiller

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class HvacModel implements ISimModel {
  readonly id = 'thermal-hvac';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'HVAC_CR_TEMP_01', // °C — nhiệt phòng điều khiển
    'HVAC_CR_HUMID_01', // % — độ ẩm phòng điều khiển
    'HVAC_SWGR_TEMP_01', // °C — nhiệt phòng tủ điện/switchgear
    'HVAC_SUPPLY_FLOW_01', // m³/h — lưu lượng gió cấp
    'HVAC_CHILLER_LOAD_01', // % — tải chiller
    'HVAC_CHW_SUPPLY_01', // °C — nước lạnh cấp
    'HVAC_FILTER_DP_01', // Pa — chênh áp bộ lọc gió
    'HVAC_FANS_RUNNING_01', // — số quạt cấp/hồi đang chạy
  ];

  private crTemp = CR_TEMP_SP_C;
  private chillerTripped = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.crTemp = CR_TEMP_SP_C;
    this.chillerTripped = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dt = ctx.dtMs / 1000;
    const loadFrac = clamp(Math.max(0, ctx.getTag('GEN_MW_01')) / 600, 0, 1.1);

    // Nhiệt phòng điều khiển bám đích khi chiller chạy; mất làm mát → trôi lên nhiệt sự cố (quán tính TAU).
    const target = this.chillerTripped ? CR_TEMP_FAIL_C : CR_TEMP_SP_C;
    this.crTemp += (target - this.crTemp) * (dt / TAU_CR_S);

    const chillerLoad = this.chillerTripped ? 0 : clamp(45 + 35 * loadFrac, 0, 100); // tải chiller theo nhiệt thiết bị
    const swgrTemp = this.chillerTripped ? 40 : 26 + 6 * loadFrac; // phòng tủ điện: tải nhiệt I²R theo tải máy
    const humid = this.chillerTripped ? 65 : 50; // mất làm mát → ẩm tăng
    const chwSupply = this.chillerTripped ? 18 : CHW_SUPPLY_C; // nước lạnh mất làm mát → ấm lên

    return {
      outputs: [
        { tagId: 'HVAC_CR_TEMP_01', value: this.crTemp, quality: 'Good' },
        { tagId: 'HVAC_CR_HUMID_01', value: humid, quality: 'Good' },
        { tagId: 'HVAC_SWGR_TEMP_01', value: swgrTemp, quality: 'Good' },
        { tagId: 'HVAC_SUPPLY_FLOW_01', value: this.chillerTripped ? 0 : 42000, quality: 'Good' },
        { tagId: 'HVAC_CHILLER_LOAD_01', value: chillerLoad, quality: 'Good' },
        { tagId: 'HVAC_CHW_SUPPLY_01', value: chwSupply, quality: 'Good' },
        { tagId: 'HVAC_FILTER_DP_01', value: 120 + 60 * loadFrac, quality: 'Good' },
        { tagId: 'HVAC_FANS_RUNNING_01', value: this.chillerTripped ? 2 : 4, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { crTemp: this.crTemp, chillerTripped: this.chillerTripped ? 1 : 0 } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.crTemp = snapshot.state.crTemp ?? CR_TEMP_SP_C;
    this.chillerTripped = (snapshot.state.chillerTripped ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    // Trip chiller HVAC: mất làm mát → nhiệt/ẩm phòng điều khiển & tủ điện tăng (OTS).
    if (m.id === 'hvac-chiller-trip') this.chillerTripped = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'hvac-chiller-trip') this.chillerTripped = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

// Plugin thermal-power-600 — FuelOilModel (ISimModel, doc 10 §10 BOP — Dầu đốt khởi động & đỡ tải).
// CHỈ import @idtp/sdk. Hệ Balance-of-Plant §10: HFO (heavy fuel oil, hâm nóng để đạt độ nhớt phun) +
// LDO (light diesel oil, mồi lửa). Dầu CHỈ đốt khi than THẤP (khởi động/đỡ lửa) — coal < ngưỡng; ở tải
// than cao, súng dầu rút ra → lưu lượng dầu 0 (đúng vận hành). ADDITIVE — sinh tag FO_*, đọc BLR_COAL_
// FLOW_01. Tất định (không Math.random). Có TRẠNG THÁI (mức bồn + nhiệt HFO) → snapshot/restore cho OTS.
//
// [GIẢ ĐỊNH] GĐ-90: ngưỡng đốt dầu 60 t/h · HFO hâm 120 °C (độ nhớt phun) · áp cấp 25 barg · sức chứa
// bồn HFO 2000 t / LDO 500 t = hiệu chỉnh theo hệ dầu đốt thật khi có.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const COAL_OIL_THRESHOLD_TPH = 60; // < ngưỡng → đốt kèm dầu (khởi động/đỡ lửa)
const OIL_MAX_TPH = 20; // lưu lượng dầu tối đa khi mồi (không than)
const HFO_TEMP_SP_C = 120; // nhiệt HFO để đạt độ nhớt phun (hâm bằng hơi phụ trợ)
const HFO_TAU_S = 60; // quán tính nhiệt hâm HFO
const FO_SUPPLY_PRESS_BARG = 25; // áp cấp dầu tới vòi đốt khi bơm chạy
const HFO_TANK_T = 2000; // sức chứa bồn HFO
const LDO_TANK_T = 500; // sức chứa bồn LDO

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class FuelOilModel implements ISimModel {
  readonly id = 'thermal-fuel-oil';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'FO_FLOW_01', // t/h — lưu lượng dầu đốt (0 ở tải than cao)
    'FO_HFO_TANK_LEVEL_01', // % — mức bồn HFO
    'FO_LDO_TANK_LEVEL_01', // % — mức bồn LDO
    'FO_HFO_TEMP_01', // °C — nhiệt HFO sau hâm (độ nhớt phun)
    'FO_SUPPLY_PRESS_01', // barg — áp cấp dầu tới vòi đốt
    'FO_PUMP_RUNNING_01', // — bơm dầu đang chạy (1/0)
  ];

  private hfoLevel = 85; // %
  private ldoLevel = 90; // %
  private hfoTemp = 120; // °C — hâm luôn duy trì để dầu bơm được

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.hfoLevel = 85;
    this.ldoLevel = 90;
    this.hfoTemp = 120;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dtH = ctx.dtMs / 3_600_000; // giờ
    const dt = ctx.dtMs / 1000; // giây
    const coal = Math.max(0, ctx.getTag('BLR_COAL_FLOW_01'));
    // Đốt dầu khi than thấp (khởi động/đỡ lửa): dưới ngưỡng, dầu bù phần thiếu để giữ ngọn lửa.
    const firingOil = coal > 0.5 && coal < COAL_OIL_THRESHOLD_TPH;
    const oilFlow = firingOil ? ((COAL_OIL_THRESHOLD_TPH - coal) / COAL_OIL_THRESHOLD_TPH) * OIL_MAX_TPH : 0;
    const pumpRunning = firingOil;

    // HFO luôn được hâm nóng (giữ độ nhớt bơm được) → bám 120 °C có quán tính.
    this.hfoTemp += (HFO_TEMP_SP_C - this.hfoTemp) * (dt / HFO_TAU_S);
    // Bồn hao khi đốt dầu (HFO là nhiên liệu chính khi mồi; LDO hao chậm hơn — mồi ngọn lửa).
    this.hfoLevel = clamp(this.hfoLevel - ((oilFlow * 0.8) / HFO_TANK_T) * 100 * dtH, 0, 100);
    this.ldoLevel = clamp(this.ldoLevel - ((oilFlow * 0.2) / LDO_TANK_T) * 100 * dtH, 0, 100);

    return {
      outputs: [
        { tagId: 'FO_FLOW_01', value: oilFlow, quality: 'Good' },
        { tagId: 'FO_HFO_TANK_LEVEL_01', value: this.hfoLevel, quality: 'Good' },
        { tagId: 'FO_LDO_TANK_LEVEL_01', value: this.ldoLevel, quality: 'Good' },
        { tagId: 'FO_HFO_TEMP_01', value: this.hfoTemp, quality: 'Good' },
        { tagId: 'FO_SUPPLY_PRESS_01', value: pumpRunning ? FO_SUPPLY_PRESS_BARG : 0, quality: 'Good' },
        { tagId: 'FO_PUMP_RUNNING_01', value: pumpRunning ? 1 : 0, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { hfoLevel: this.hfoLevel, ldoLevel: this.ldoLevel, hfoTemp: this.hfoTemp } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.hfoLevel = snapshot.state.hfoLevel ?? 85;
    this.ldoLevel = snapshot.state.ldoLevel ?? 90;
    this.hfoTemp = snapshot.state.hfoTemp ?? 120;
  }
  injectMalfunction(_m: IMalfunction): void {
    // model không có malfunction riêng ở v1.40
  }
  clearMalfunction(_id: string): void {
    // không giữ trạng thái malfunction
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

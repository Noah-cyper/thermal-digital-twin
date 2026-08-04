// Plugin thermal-power-600 — ChemicalDosingModel (ISimModel, doc 10 §10 BOP — Hoá chất điều hoà chu trình).
// CHỈ import @idtp/sdk. Hệ hoá chất giữ hoá lý chu trình hơi-nước (EPRI/VGB): amoniac điều pH nước cấp
// (chống ăn mòn CO₂), chất khử oxy (hydrazine/carbohydrazide) khử O₂ hoà tan, phosphate xử lý nội bộ bao
// hơi (drum boiler — chống cáu cặn, đệm pH). Bơm định lượng bơm theo lưu lượng. Độ dẫn cation của hơi =
// chỉ số tinh khiết (phát hiện rò/nhiễm bẩn).
//
// ADDITIVE — sinh tag CHEM_* độc lập; đọc BLR_STEAM_FLOW_01 (định lượng ∝ lưu lượng). Tất định (không
// Math.random). Có TRẠNG THÁI (mức bồn hoá chất) → snapshot/restore. Malfunction 'chem-dosing-fail' →
// bơm định lượng hỏng → pH trôi + độ dẫn cation tăng (nguy cơ ăn mòn). Ở vận hành bình thường giữ hoá lý đích.
//
// Neo Design Basis (Phụ lục A): chu trình drum-type AVT/PT. pH đích, liều hoá chất, phosphate residual,
// độ dẫn cation = [GIẢ ĐỊNH] GĐ-104.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const FW_PH_TARGET = 9.3; // pH nước cấp đích (AVT — all-volatile treatment)
const DRUM_PH_TARGET = 9.6; // pH nước bao hơi đích (phosphate treatment)
const PHOSPHATE_TARGET_PPM = 5; // ppm — phosphate residual bao hơi
const CATION_COND_CLEAN = 0.15; // µS/cm — độ dẫn cation hơi khi hoá lý tốt
const CATION_COND_FAIL = 0.9; // µS/cm — độ dẫn cation khi mất điều hoá (nhiễm bẩn)
const FW_PH_FAIL = 8.4; // pH nước cấp khi mất amoniac (tụt về vùng ăn mòn)
const STEAM_REF_TPH = 1500; // lưu lượng hơi chuẩn (định mức liều)

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class ChemicalDosingModel implements ISimModel {
  readonly id = 'thermal-chemical-dosing';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'CHEM_FW_PH_01', // — pH nước cấp
    'CHEM_DRUM_PH_01', // — pH nước bao hơi
    'CHEM_AMMONIA_DOSE_01', // L/h — bơm amoniac (điều pH)
    'CHEM_HYDRAZINE_DOSE_01', // L/h — bơm khử oxy
    'CHEM_PHOSPHATE_DOSE_01', // L/h — bơm phosphate bao hơi
    'CHEM_DRUM_PHOSPHATE_01', // ppm — phosphate residual bao hơi
    'CHEM_CATION_COND_01', // µS/cm — độ dẫn cation hơi (tinh khiết)
    'CHEM_DOSING_TANK_01', // % — mức bồn hoá chất ngày
  ];

  private tankPct = 85; // %
  private faulted = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.tankPct = 85;
    this.faulted = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dtH = ctx.dtMs / 3_600_000; // giờ
    const steam = Math.max(0, ctx.getTag('BLR_STEAM_FLOW_01'));
    const flowFrac = clamp(steam / STEAM_REF_TPH, 0, 1.2);
    const dosing = !this.faulted && steam > 50; // đang định lượng khi có lưu lượng & không lỗi

    // Liều bơm định lượng ∝ lưu lượng hơi (0 khi lỗi/dừng lò).
    const ammonia = dosing ? 12 * flowFrac : 0; // L/h
    const hydrazine = dosing ? 6 * flowFrac : 0; // L/h
    const phosphate = dosing ? 8 * flowFrac : 0; // L/h

    // Hoá lý: giữ đích khi định lượng; mất điều hoá → pH tụt, độ dẫn cation tăng.
    const fwPh = dosing ? FW_PH_TARGET : FW_PH_FAIL;
    const drumPh = dosing ? DRUM_PH_TARGET : FW_PH_FAIL + 0.2;
    const phosphateResidual = dosing ? PHOSPHATE_TARGET_PPM : 1;
    const cationCond = dosing ? CATION_COND_CLEAN : CATION_COND_FAIL;

    // Bồn hoá chất ngày: tiêu theo liều, bù đầy chậm (châm bồn từ kho).
    const consume = (ammonia + hydrazine + phosphate) * 0.01; // %/h quy đổi
    this.tankPct = clamp(this.tankPct - consume * dtH + 3 * dtH, 0, 100);

    return {
      outputs: [
        { tagId: 'CHEM_FW_PH_01', value: fwPh, quality: 'Good' },
        { tagId: 'CHEM_DRUM_PH_01', value: drumPh, quality: 'Good' },
        { tagId: 'CHEM_AMMONIA_DOSE_01', value: ammonia, quality: 'Good' },
        { tagId: 'CHEM_HYDRAZINE_DOSE_01', value: hydrazine, quality: 'Good' },
        { tagId: 'CHEM_PHOSPHATE_DOSE_01', value: phosphate, quality: 'Good' },
        { tagId: 'CHEM_DRUM_PHOSPHATE_01', value: phosphateResidual, quality: 'Good' },
        { tagId: 'CHEM_CATION_COND_01', value: cationCond, quality: 'Good' },
        { tagId: 'CHEM_DOSING_TANK_01', value: this.tankPct, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { tankPct: this.tankPct, faulted: this.faulted ? 1 : 0 } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.tankPct = snapshot.state.tankPct ?? 85;
    this.faulted = (snapshot.state.faulted ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    // Bơm định lượng hỏng: mất điều hoá → pH tụt vùng ăn mòn + độ dẫn cation tăng (OTS).
    if (m.id === 'chem-dosing-fail') this.faulted = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'chem-dosing-fail') this.faulted = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

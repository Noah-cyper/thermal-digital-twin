// Plugin thermal-power-600 — RegenBalanceModel (ISimModel, doc 10 §6 — NỐI drain cascade vào CÂN BẰNG NHIỆT).
// CHỈ import @idtp/sdk. Lượng hoá tác động NHIỆT của việc drain bình gia nhiệt bị CHUYỂN HƯỚNG (van xả khẩn
// đổ thẳng bình ngưng thay vì cascade/gia nhiệt nước cấp): hơi trích đã ngưng lẽ ra sưởi nước cấp nay mất
// xuống bình ngưng → nước cấp vào economizer NGUỘI hơn → lò phải cấp nhiều nhiệt hơn → heat rate XẤU đi.
//
// ADDITIVE + GUARD 0 hồi quy: đọc FWH_DRAIN_TO_COND_01 vs mức cascade NỀN (9% hơi). Ở vận hành bình thường
// van xả khẩn ĐÓNG → drain = nền → tổn thất = 0 → nhiệt nước cấp hiệu dụng = danh nghĩa, heat rate hiệu
// dụng = PLANT_CYCLE_HR (KHÔNG đổi). Chỉ khi malfunction heater-drain-high mở van xả khẩn → tổn thất > 0,
// phơi bày mức phạt hiệu năng. KHÔNG ghi đè FW_ECON_INLET/PLANT_CYCLE_HR — sinh tag "hiệu dụng" MỚI.
// Read-only với physics lõi (chỉ đọc + tổng hợp). Tất định.
//
// Neo Design Basis (Phụ lục A): cp nước 4,4 kJ/kg·K · Δh_boiler 2145 kJ/kg · cascade nền 9% hơi. ΔT hồi
// nhiệt LP đại diện, hệ số quy đổi = [GIẢ ĐỊNH] GĐ-110 (số heat-balance thật thay khi có — như M-06).
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const CASCADE_BASE_FRAC = 0.09; // cascade drain nền (khớp FeedwaterDrainsModel) — trên mức này là chuyển hướng
const CP_WATER_KJKGK = 4.4; // nhiệt dung riêng nước cấp (khớp FeedwaterTrainModel GĐ-66)
const DH_BOILER_KJKG = 2145; // Δh nước cấp → hơi chính (khớp FeedwaterTrainModel)
const T_COND_NOM_C = 34; // condensate/hotwell danh nghĩa (nơi drain chuyển hướng đổ về)

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class RegenBalanceModel implements ISimModel {
  readonly id = 'thermal-regen-balance';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'PLANT_REGEN_LOSS_MW_01', // MWth — nhiệt hồi nhiệt mất xuống bình ngưng do drain chuyển hướng (0 khi bình thường)
    'PLANT_FW_TEMP_DEPRESSION_01', // °C — độ hạ nhiệt nước cấp vào econ do mất hồi nhiệt
    'FW_ECON_INLET_EFFECTIVE_01', // °C — nhiệt nước cấp vào econ HIỆU DỤNG (danh nghĩa − hạ nhiệt)
    'PLANT_HR_REGEN_PENALTY_01', // % — mức phạt heat rate do mất hồi nhiệt
    'PLANT_CYCLE_HR_EFF_01', // kJ/kWh — heat rate chu trình HIỆU DỤNG (gồm phạt regen)
    'PLANT_REGEN_HEALTHY_01', // 0/1 — hồi nhiệt bình thường (không chuyển hướng drain)
  ];

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    // không giữ trạng thái (lượng hoá tức thời từ tag đã có)
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const steam = Math.max(0, ctx.getTag('BLR_STEAM_FLOW_01')); // t/h
    const drainToCond = Math.max(0, ctx.getTag('FWH_DRAIN_TO_COND_01')); // t/h (từ FeedwaterDrainsModel)
    const econInlet = ctx.getTag('FW_ECON_INLET_TEMP_01'); // °C (từ FeedwaterTrainModel)
    const tDea = ctx.getTag('FW_DEAERATOR_TEMP_01'); // °C
    const cycleHr = Math.max(0, ctx.getTag('PLANT_CYCLE_HR_01')); // kJ/kWh (từ FeedwaterTrainModel)

    // Lưu lượng drain CHUYỂN HƯỚNG = phần vượt mức cascade nền (van xả khẩn). Ở bình thường ≈ 0.
    const baseDrain = steam * CASCADE_BASE_FRAC;
    const divertedTph = Math.max(0, drainToCond - baseDrain * 1.02); // 2% dung sai chống nhiễu → guard 0

    // Nhiệt hồi nhiệt mất: drain chuyển hướng mang enthalpy (so với condensate) xuống bình ngưng.
    const dtRegen = Math.max(0, tDea - T_COND_NOM_C); // °C — ΔT hồi nhiệt LP đại diện
    const regenLossMw = (divertedTph / 3.6) * CP_WATER_KJKGK * dtRegen / 1000; // MWth

    // Độ hạ nhiệt nước cấp: nhiệt mất chia dòng nước cấp → nước cấp vào econ nguội đi.
    const mdot = Math.max(1e-3, steam / 3.6); // kg/s
    const depression = (regenLossMw * 1000) / (mdot * CP_WATER_KJKGK); // °C
    const econEffective = econInlet - depression;

    // Phạt heat rate: nước cấp nguội hơn → cần thêm nhiệt lò/kg = cp·ΔT_hạ → % trên Δh_boiler.
    const hrPenaltyPct = (CP_WATER_KJKGK * depression / DH_BOILER_KJKG) * 100;
    const cycleHrEff = cycleHr * (1 + hrPenaltyPct / 100);
    const healthy = divertedTph < 1;

    return {
      outputs: [
        { tagId: 'PLANT_REGEN_LOSS_MW_01', value: regenLossMw, quality: 'Good' },
        { tagId: 'PLANT_FW_TEMP_DEPRESSION_01', value: depression, quality: 'Good' },
        { tagId: 'FW_ECON_INLET_EFFECTIVE_01', value: econEffective, quality: 'Good' },
        { tagId: 'PLANT_HR_REGEN_PENALTY_01', value: hrPenaltyPct, quality: 'Good' },
        { tagId: 'PLANT_CYCLE_HR_EFF_01', value: cycleHrEff, quality: 'Good' },
        { tagId: 'PLANT_REGEN_HEALTHY_01', value: healthy ? 1 : 0, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: {} };
  }
  restore(_snapshot: ISimSnapshot): void {
    // không giữ trạng thái
  }
  injectMalfunction(_m: IMalfunction): void {
    // không có malfunction riêng — tác động đến từ heater-drain-high (FeedwaterDrainsModel) qua tag đã đọc
  }
  clearMalfunction(_id: string): void {
    // không giữ trạng thái malfunction
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

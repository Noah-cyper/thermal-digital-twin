// Plugin thermal-power-600 — PlantBalanceModel (ISimModel, doc 10 §6 — CAPSTONE: cân bằng khối lượng &
// năng lượng toàn nhà máy). CHỈ import @idtp/sdk. Chạy CUỐI CÙNG: đọc đầu ra của TẤT CẢ mô hình con
// (than/công suất/net/nhiệt thải/hiệu suất lò/khói/CO₂) → KIỂM CHỨNG CHÉO bằng định luật bảo toàn:
// nhiệt nhiên liệu = công suất gộp + nhiệt thải bình ngưng + tổn thất lò (khép ~100 % → các mô hình con
// NHẤT QUÁN). Sinh KPI toàn nhà máy: hiệu suất net, heat rate đơn vị net, cường độ CO₂. ADDITIVE
// (0 hồi quy). Tất định (không Math.random).
//
// Neo Design Basis (Phụ lục A): LHV 21.500 kJ/kg · net 558 MW · heat rate đơn vị 9.200 kJ/kWh (net,
// η≈39 %). LƯU Ý: hiệu suất net mô hình (~33 %) THẤP HƠN 39 % thiết kế do enthalpy chu trình [GIẢ ĐỊNH]
// bảo thủ (GĐ-66/68) — cân bằng năng lượng vẫn KHÉP ~100 % (mô hình NHẤT QUÁN nội bộ), chênh tuyệt đối
// với thiết kế là hạng mục calibrate bằng heat balance thật, nêu rõ (GĐ-73).
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const LHV_KJ_PER_KG = 21_500;

export class PlantBalanceModel implements ISimModel {
  readonly id = 'thermal-plant-balance';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'PLANT_ENERGY_IN_01', // MWth — nhiệt nhiên liệu (than × LHV)
    'PLANT_BOILER_LOSS_01', // MWth — tổn thất lò (= nhiên liệu × (1 − η lò))
    'PLANT_HEAT_REJECT_01', // MWth — nhiệt thải bình ngưng
    'PLANT_ENERGY_CLOSURE_01', // % — khép cân bằng năng lượng (gộp + thải + tổn thất) / nhiên liệu
    'PLANT_NET_EFF_01', // % — hiệu suất net toàn nhà máy (net / nhiên liệu)
    'PLANT_UNIT_HR_NET_01', // kJ/kWh — heat rate đơn vị (net)
    'PLANT_CO2_INTENSITY_01', // g/kWh — cường độ phát thải CO₂ (theo net)
    'PLANT_AIR_FLOW_01', // t/h — gió cháy (kiểm toán khối lượng: khói − than)
  ];

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    // model không giữ trạng thái (kiểm toán tức thời từ đầu ra các mô hình con)
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const coal = Math.max(0, ctx.getTag('BLR_COAL_FLOW_01')); // t/h
    const gross = Math.max(0, ctx.getTag('GEN_MW_01')); // MW
    const net = Math.max(0, ctx.getTag('ELEC_NET_MW_01')); // MW
    const qCond = Math.max(0, ctx.getTag('COND_DUTY_01')); // MWth
    const blrEff = ctx.getTag('BLR_EFF_01'); // %
    const fgFlow = Math.max(0, ctx.getTag('FG_FLOW_01')); // t/h
    const co2 = Math.max(0, ctx.getTag('EMI_CO2_RATE_01')); // t/h

    // Nhiệt nhiên liệu & tổn thất lò.
    const qFuel = (coal / 3.6) * LHV_KJ_PER_KG / 1000; // MWth
    const boilerLoss = qFuel * (1 - Math.max(0, Math.min(100, blrEff)) / 100);

    // KIỂM CHỨNG bảo toàn năng lượng: gộp + nhiệt thải + tổn thất lò ≈ nhiên liệu (các số ĐỘC LẬP nguồn).
    const energyOut = gross + qCond + boilerLoss;
    const closure = qFuel > 1 ? (energyOut / qFuel) * 100 : 0;

    // KPI toàn nhà máy.
    const netEff = qFuel > 1 ? (net / qFuel) * 100 : 0;
    const unitHrNet = net > 1 ? (qFuel * 3600) / net : 0; // kJ/kWh
    const co2Intensity = net > 1 ? (co2 * 1000) / net : 0; // g/kWh (t/h·1e6 / (MW·1e3))
    const airFlow = Math.max(0, fgFlow - coal); // kiểm toán khối lượng: khói = than + gió

    return {
      outputs: [
        { tagId: 'PLANT_ENERGY_IN_01', value: qFuel, quality: 'Good' },
        { tagId: 'PLANT_BOILER_LOSS_01', value: boilerLoss, quality: 'Good' },
        { tagId: 'PLANT_HEAT_REJECT_01', value: qCond, quality: 'Good' },
        { tagId: 'PLANT_ENERGY_CLOSURE_01', value: closure, quality: 'Good' },
        { tagId: 'PLANT_NET_EFF_01', value: netEff, quality: 'Good' },
        { tagId: 'PLANT_UNIT_HR_NET_01', value: unitHrNet, quality: 'Good' },
        { tagId: 'PLANT_CO2_INTENSITY_01', value: co2Intensity, quality: 'Good' },
        { tagId: 'PLANT_AIR_FLOW_01', value: airFlow, quality: 'Good' },
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
    // model không có malfunction riêng ở v1.26
  }
  clearMalfunction(_id: string): void {
    // không giữ trạng thái malfunction
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

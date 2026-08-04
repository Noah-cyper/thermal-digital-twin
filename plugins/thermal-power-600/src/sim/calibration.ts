// Plugin thermal-power-600 — CalibrationModel (ISimModel, doc 10 §10 / doc 25 — hiệu chỉnh hiệu năng).
// CHỈ import @idtp/sdk. KHÔNG đổi vật lý — đăng ký CUỐI CÙNG, đọc KPI đã tính (heat rate / hiệu suất /
// nhiệt CW / khép cân bằng) → LƯỢNG HOÁ ĐỘ LỆCH so với mốc Design Basis (Phụ lục A). Đây là bước ĐẦU của
// "calibrate bằng heat-balance thật": phải ĐO độ lệch trước khi chỉnh. ADDITIVE tuyệt đối (0 hồi quy).
//
// Mốc Design Basis (Phụ lục A §2/§3): heat rate đơn vị 9.200 kJ/kWh (net) · hiệu suất net 39% · nhiệt CW
// cấp thiết kế ~19 °C (ôn hoà, ⇒ chân không 5,4 kPa) · khép cân bằng năng lượng 100%.
//
// LƯU Ý (GĐ-67/68): mô hình hiện cho heat rate/hiệu suất KÉM hơn mốc (đốt than nhiều hơn mốc ở cùng MW) và
// nhiệt CW CAO hơn (bầu ướt nhiệt đới 27 °C ⇒ CW ~31 °C). Đây là ĐỘ LỆCH THẬT cần hiệu chỉnh bằng số vận
// hành thật (đổi hằng số coal→steam→MW = rủi ro hồi quy cao → HOÃN tới khi có dữ liệu). Model này PHƠI BÀY
// độ lệch, KHÔNG che giấu.
//
// MỞ RỘNG (v1.44, batch c-2): đo thêm độ lệch các ĐIỀU KIỆN HƠI/CHÂN KHÔNG ĐƯỢC ĐIỀU KHIỂN (nhiệt hơi chính ·
// nhiệt hot reheat · áp hơi chính · chân không bình ngưng) vs mốc Design Basis. Độ lệch ~0 CHỨNG MINH sim giữ
// đúng mọi điểm hơi thiết kế → KHU BIỆT: gap heat-rate/η KHÔNG do sai điều kiện hơi mà do hằng số coal→steam→MW
// (đúng chẩn đoán M-06). Vẫn ADDITIVE tuyệt đối — chỉ ĐO, KHÔNG đổi vật lý, KHÔNG bịa số (mốc từ Phụ lục A).
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

/* ── Mốc Design Basis (Phụ lục A) ── */
const HR_TARGET = 9200; // kJ/kWh net
const EFF_TARGET = 39; // % net
const CW_TARGET_C = 19; // °C — CW cấp thiết kế (ôn hoà) ⇒ chân không 5,4 kPa
const CLOSURE_TARGET = 100; // % — khép cân bằng năng lượng
// Mốc điều kiện hơi/chân không thiết kế (Phụ lục A §Turbine/Steam) — các biến ĐƯỢC ĐIỀU KHIỂN. Đo độ lệch
// để CHỨNG MINH sim giữ đúng điểm thiết kế → khu biệt gap heat-rate/η KHÔNG do sai điều kiện hơi (M-06).
const MST_TARGET_C = 541; // °C — nhiệt hơi chính SH out
const HRH_TARGET_C = 541; // °C — nhiệt hot reheat
const MSP_TARGET_MPA = 17.5; // MPa — áp hơi chính SH out
const VAC_TARGET_KPA = 5.4; // kPa(a) — chân không bình ngưng thiết kế

export class CalibrationModel implements ISimModel {
  readonly id = 'thermal-calibration';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'PLANT_CAL_HR_TGT_01', // kJ/kWh — mốc heat rate đơn vị
    'PLANT_CAL_HR_DEV_01', // % — độ lệch heat rate ((sim − mốc)/mốc), dương = kém hơn mốc
    'PLANT_CAL_EFF_TGT_01', // % — mốc hiệu suất net
    'PLANT_CAL_EFF_DEV_01', // điểm % — độ lệch hiệu suất (sim − mốc), âm = kém hơn mốc
    'PLANT_CAL_CW_TGT_01', // °C — mốc nhiệt CW cấp thiết kế
    'PLANT_CAL_CW_DEV_01', // °C — độ lệch nhiệt CW (sim − mốc), dương = nóng hơn (đẩy back-pressure)
    'PLANT_CAL_CLOSURE_DEV_01', // điểm % — độ lệch khép cân bằng (sim − 100), ~0 = kiểm toán NL tốt
    // Điều kiện hơi/chân không ĐƯỢC ĐIỀU KHIỂN — độ lệch ~0 chứng minh sim ở đúng điểm thiết kế.
    'PLANT_CAL_MST_TGT_01', // °C — mốc nhiệt hơi chính
    'PLANT_CAL_MST_DEV_01', // °C — độ lệch nhiệt hơi chính (sim − mốc)
    'PLANT_CAL_HRH_TGT_01', // °C — mốc nhiệt hot reheat
    'PLANT_CAL_HRH_DEV_01', // °C — độ lệch nhiệt hot reheat (sim − mốc)
    'PLANT_CAL_MSP_TGT_01', // MPa — mốc áp hơi chính
    'PLANT_CAL_MSP_DEV_01', // MPa — độ lệch áp hơi chính (sim − mốc)
    'PLANT_CAL_VAC_TGT_01', // kPa(a) — mốc chân không bình ngưng
    'PLANT_CAL_VAC_DEV_01', // kPa(a) — độ lệch chân không (sim − mốc), dương = kém chân không hơn
  ];

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    // không giữ trạng thái (lượng hoá tức thời từ KPI đã tính)
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const hrSim = Math.max(0, ctx.getTag('PLANT_UNIT_HR_NET_01')); // kJ/kWh
    const effSim = ctx.getTag('PLANT_NET_EFF_01'); // %
    const cwSim = ctx.getTag('CT_CW_SUPPLY_01'); // °C — nhiệt CW cấp thực (từ tháp làm mát)
    const closureSim = ctx.getTag('PLANT_ENERGY_CLOSURE_01'); // %

    const hrDev = hrSim > 1 ? ((hrSim - HR_TARGET) / HR_TARGET) * 100 : 0;

    // Điều kiện hơi/chân không được điều khiển — đọc trực tiếp, đo lệch so mốc thiết kế.
    const mstSim = ctx.getTag('BLR_MSTM_SH_TEMP_01'); // °C
    const hrhSim = ctx.getTag('TRB_HRH_TEMP_01'); // °C
    const mspSim = ctx.getTag('BLR_MSTM_SH_PRESS_01'); // MPa
    const vacSim = ctx.getTag('TRB_COND_VACUUM_01'); // kPa(a)

    return {
      outputs: [
        { tagId: 'PLANT_CAL_HR_TGT_01', value: HR_TARGET, quality: 'Good' },
        { tagId: 'PLANT_CAL_HR_DEV_01', value: hrDev, quality: 'Good' },
        { tagId: 'PLANT_CAL_EFF_TGT_01', value: EFF_TARGET, quality: 'Good' },
        { tagId: 'PLANT_CAL_EFF_DEV_01', value: effSim - EFF_TARGET, quality: 'Good' },
        { tagId: 'PLANT_CAL_CW_TGT_01', value: CW_TARGET_C, quality: 'Good' },
        { tagId: 'PLANT_CAL_CW_DEV_01', value: cwSim - CW_TARGET_C, quality: 'Good' },
        { tagId: 'PLANT_CAL_CLOSURE_DEV_01', value: closureSim - CLOSURE_TARGET, quality: 'Good' },
        { tagId: 'PLANT_CAL_MST_TGT_01', value: MST_TARGET_C, quality: 'Good' },
        { tagId: 'PLANT_CAL_MST_DEV_01', value: mstSim - MST_TARGET_C, quality: 'Good' },
        { tagId: 'PLANT_CAL_HRH_TGT_01', value: HRH_TARGET_C, quality: 'Good' },
        { tagId: 'PLANT_CAL_HRH_DEV_01', value: hrhSim - HRH_TARGET_C, quality: 'Good' },
        { tagId: 'PLANT_CAL_MSP_TGT_01', value: MSP_TARGET_MPA, quality: 'Good' },
        { tagId: 'PLANT_CAL_MSP_DEV_01', value: mspSim - MSP_TARGET_MPA, quality: 'Good' },
        { tagId: 'PLANT_CAL_VAC_TGT_01', value: VAC_TARGET_KPA, quality: 'Good' },
        { tagId: 'PLANT_CAL_VAC_DEV_01', value: vacSim - VAC_TARGET_KPA, quality: 'Good' },
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
    // model không có malfunction riêng
  }
  clearMalfunction(_id: string): void {
    // không giữ trạng thái malfunction
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

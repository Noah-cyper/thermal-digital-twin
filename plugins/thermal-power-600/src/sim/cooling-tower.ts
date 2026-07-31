// Plugin thermal-power-600 — CoolingTowerModel (ISimModel, doc 10 §6 — tháp làm mát natural draft khép
// vòng CW). CHỈ import @idtp/sdk. CHIỀU SÂU vật lý bổ sung (v1.24), chạy CẠNH …/condenser: đọc nhiệt
// thải/độ tăng nhiệt CW tươi → khép vòng nước tuần hoàn: nhiệt CW cấp (bầu ướt + approach), range, bốc
// hơi, nước bổ sung, nhiệt thải khí quyển. ADDITIVE — không đổi tag condenser/CW (0 hồi quy). Tất định.
//
// Neo Design Basis (Phụ lục A): tháp làm mát natural draft hyperbolic 165 m · nước tuần hoàn 64.000
// m³/h · chân không 5,4 kPa. Bầu ướt/approach/ẩn nhiệt/hệ số bổ sung = [GIẢ ĐỊNH] (GĐ-71).
//
// LƯU Ý HIỆU NĂNG THẬT (không phải lỗi): với bầu ướt NHIỆT ĐỚI ~27 °C, CW cấp ≈ 31 °C → chân không
// bình ngưng thực tế sẽ CAO HƠN 5,4 kPa thiết kế (mốc ôn hoà, CW ~19 °C, GĐ-67). Tháp phản ánh điều
// kiện địa phương THẬT; 5,4 kPa là điểm thiết kế. Chênh này là dữ kiện hiệu năng, nêu rõ để calibrate.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

/* ── [GIẢ ĐỊNH] hiệu chỉnh (GĐ-71) ── */
const WET_BULB_C = 27; // bầu ướt thiết kế (nhiệt đới VN)
const APPROACH_C = 4; // approach tháp natural draft (CW cấp − bầu ướt)
const LATENT_KJKG = 2400; // ẩn nhiệt bốc hơi ở ~40 °C
const MAKEUP_FACTOR = 1.5; // nước bổ sung / bốc hơi (gồm blowdown + drift, ~3 chu kỳ cô đặc)

export class CoolingTowerModel implements ISimModel {
  readonly id = 'thermal-cooling-tower';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'CT_WETBULB_01', // °C — bầu ướt môi trường
    'CT_CW_SUPPLY_01', // °C — CW cấp (lạnh) về bình ngưng
    'CT_APPROACH_01', // °C — approach (CW cấp − bầu ướt)
    'CT_RANGE_01', // °C — range (CW nóng − CW lạnh = độ tăng nhiệt bình ngưng)
    'CT_HEAT_REJECT_01', // MWth — nhiệt thải ra khí quyển
    'CT_EVAP_LOSS_01', // t/h — bốc hơi
    'CT_MAKEUP_01', // t/h — nước bổ sung (bốc hơi + blowdown + drift)
    'CT_CW_HOT_01', // °C — CW nóng vào tháp (spray header = CW cấp + range)
    'CT_FILL_MID_01', // °C — nhiệt nước giữa lớp fill (làm mát dần khi rơi qua fill)
  ];

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    // model không giữ trạng thái (khép vòng tức thời theo tải nhiệt; đầu vào đã có quán tính)
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const duty = Math.max(0, ctx.getTag('COND_DUTY_01')); // MWth nhiệt thải bình ngưng
    const range = Math.max(0, ctx.getTag('COND_CW_RISE_01')); // °C độ tăng nhiệt CW
    const rejecting = duty > 1;

    // CW cấp (lạnh) = bầu ướt + approach; range = độ tăng nhiệt qua bình ngưng.
    const cwSupply = WET_BULB_C + APPROACH_C;
    // Profile nhiệt QUA FILL (tháp natural-draft không có "cell" như tháp cưỡng bức; nước nóng rơi qua
    // fill và nguội dần): spray header nóng = cấp + range → giữa fill → bể (= cấp lạnh).
    const cwHot = cwSupply + range;
    const fillMid = cwSupply + range / 2;

    // Bốc hơi = nhiệt thải / ẩn nhiệt; nước bổ sung = bốc hơi × hệ số (blowdown + drift).
    const evapTph = rejecting ? (duty * 1000) / LATENT_KJKG * 3.6 : 0; // MW→kW /kJkg = kg/s → t/h
    const makeupTph = evapTph * MAKEUP_FACTOR;

    return {
      outputs: [
        { tagId: 'CT_WETBULB_01', value: WET_BULB_C, quality: 'Good' },
        { tagId: 'CT_CW_SUPPLY_01', value: cwSupply, quality: 'Good' },
        { tagId: 'CT_APPROACH_01', value: APPROACH_C, quality: 'Good' },
        { tagId: 'CT_RANGE_01', value: range, quality: 'Good' },
        { tagId: 'CT_HEAT_REJECT_01', value: duty, quality: 'Good' },
        { tagId: 'CT_EVAP_LOSS_01', value: evapTph, quality: 'Good' },
        { tagId: 'CT_MAKEUP_01', value: makeupTph, quality: 'Good' },
        { tagId: 'CT_CW_HOT_01', value: cwHot, quality: 'Good' },
        { tagId: 'CT_FILL_MID_01', value: fillMid, quality: 'Good' },
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
    // model không có malfunction riêng ở v1.24
  }
  clearMalfunction(_id: string): void {
    // không giữ trạng thái malfunction
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

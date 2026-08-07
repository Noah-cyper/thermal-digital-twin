// Plugin thermal-power-600 — BfpCavitationModel (ISimModel, doc 10 §6 — bơm nước cấp: NPSH & chống xâm thực).
// CHỈ import @idtp/sdk. CHIỀU SÂU bơm nước cấp (BFP): NPSH KHẢ DỤNG (từ áp/nhiệt khử khí + cột tĩnh − tổn thất
// theo lưu lượng²) vs NPSH YÊU CẦU (tăng theo lưu lượng²); BIÊN NPSH < 0 → XÂM THỰC (cavitation) hư cánh. Van
// RECIRC min-flow tự mở khi lưu lượng thấp (bảo vệ bơm khỏi quá nhiệt). Đọc FW_FLOW_01 + FW_DEA_PRESS_01 +
// FW_DEAERATOR_TEMP_01 → chỉ số NPSH/biên/xâm thực/recirc.
//
// ADDITIVE — sinh tag BFP_* ĐỘC LẬP; KHÔNG đổi tag nước cấp lõi (0 hồi quy). Tất định (không Math.random). Có
// TRẠNG THÁI (cờ sự cố) → snapshot/restore. Malfunction: 'bfp-suction-low' (áp khử khí/mức tụt → NPSH khả dụng
// giảm → xâm thực) · 'bfp-recirc-stuck-open' (van recirc kẹt mở → phí năng lượng, giảm cấp nước lò).
//
// Neo Design Basis (Phụ lục A §3.2): BFP turbine-driven, lưu lượng định mức ~1500 t/h, khử khí 0,9 MPa/160°C,
// cột tĩnh khử khí ~25 m. NPSH yêu cầu định mức, hệ số tổn thất, ngưỡng min-flow = [GIẢ ĐỊNH].
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const FLOW_RATED_TPH = 1500; // t/h — lưu lượng định mức
const STATIC_HEAD_M = 25; // m — cột tĩnh khử khí trên BFP
const K_FRICTION_M = 3; // m — tổn thất hút ở lưu lượng định mức
const K_PRESS_M_PER_MPA = 20; // m/MPa — ảnh hưởng áp khử khí lên NPSH khả dụng
const P_DEA_NOM_MPA = 0.90; // MPa — áp khử khí danh định
const NPSHR_RATED_M = 18; // m — NPSH yêu cầu ở lưu lượng định mức
const SUCTION_LOW_PENALTY_M = 16; // m — NPSH khả dụng tụt khi mất áp/mức hút
const MIN_FLOW_TPH = 450; // t/h — dưới ngưỡng này van recirc mở (30% định mức)
const MARGIN_HEALTHY_MIN_M = 2; // m — biên NPSH lành mạnh
const RECIRC_OPEN_HEALTHY_MAX = 50; // % — recirc mở quá mức ở tải = bất thường

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class BfpCavitationModel implements ISimModel {
  readonly id = 'thermal-bfp-cavitation';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'BFP_FLOW_01', // t/h — lưu lượng bơm nước cấp
    'BFP_SUCTION_PRESS_01', // MPa — áp hút BFP (khử khí)
    'BFP_NPSH_AVAIL_01', // m — NPSH khả dụng
    'BFP_NPSH_REQ_01', // m — NPSH yêu cầu
    'BFP_NPSH_MARGIN_01', // m — biên NPSH (khả dụng − yêu cầu)
    'BFP_RECIRC_VALVE_01', // % — van recirc min-flow
    'BFP_CAVITATION_01', // 0/1 — đang xâm thực
    'BFP_HEALTHY_01', // 0/1 — bơm bình thường
  ];

  private suctionLow = false;
  private recircStuck = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.suctionLow = false;
    this.recircStuck = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const flow = Math.max(0, ctx.getTag('FW_FLOW_01'));
    const pDea = ctx.getTag('FW_DEA_PRESS_01') || P_DEA_NOM_MPA;
    const flowFrac = flow / FLOW_RATED_TPH;

    const suctionPress = this.suctionLow ? pDea - 0.4 : pDea; // sự cố mất áp hút

    // NPSH khả dụng: cột tĩnh + ảnh hưởng áp khử khí − tổn thất hút (∝ lưu lượng²) − phạt mất hút.
    const npshAvail = STATIC_HEAD_M + K_PRESS_M_PER_MPA * (suctionPress - P_DEA_NOM_MPA)
      - K_FRICTION_M * flowFrac * flowFrac
      - (this.suctionLow ? SUCTION_LOW_PENALTY_M : 0);
    // NPSH yêu cầu: tăng theo lưu lượng².
    const npshReq = NPSHR_RATED_M * flowFrac * flowFrac;
    const margin = npshAvail - npshReq;

    // Van recirc min-flow: mở khi lưu lượng dưới ngưỡng; kẹt mở = 100% bất kể lưu lượng.
    const recircValve = this.recircStuck ? 100 : clamp((MIN_FLOW_TPH - flow) / MIN_FLOW_TPH * 100, 0, 100);

    const cavitation = margin < 0 ? 1 : 0;
    const healthy = margin >= MARGIN_HEALTHY_MIN_M && !cavitation && recircValve <= RECIRC_OPEN_HEALTHY_MAX ? 1 : 0;

    return {
      outputs: [
        { tagId: 'BFP_FLOW_01', value: flow, quality: 'Good' },
        { tagId: 'BFP_SUCTION_PRESS_01', value: suctionPress, quality: 'Good' },
        { tagId: 'BFP_NPSH_AVAIL_01', value: npshAvail, quality: 'Good' },
        { tagId: 'BFP_NPSH_REQ_01', value: npshReq, quality: 'Good' },
        { tagId: 'BFP_NPSH_MARGIN_01', value: margin, quality: 'Good' },
        { tagId: 'BFP_RECIRC_VALVE_01', value: recircValve, quality: 'Good' },
        { tagId: 'BFP_CAVITATION_01', value: cavitation, quality: 'Good' },
        { tagId: 'BFP_HEALTHY_01', value: healthy, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { suctionLow: this.suctionLow ? 1 : 0, recircStuck: this.recircStuck ? 1 : 0 } };
  }
  restore(s: ISimSnapshot): void {
    this.suctionLow = (s.state.suctionLow ?? 0) > 0.5;
    this.recircStuck = (s.state.recircStuck ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'bfp-suction-low') this.suctionLow = true;
    if (m.id === 'bfp-recirc-stuck-open') this.recircStuck = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'bfp-suction-low') this.suctionLow = false;
    if (id === 'bfp-recirc-stuck-open') this.recircStuck = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

// Plugin thermal-power-600 — BypassAirRemovalModel (ISimModel, doc 10 §6/§7 — HP turbine bypass + hút khí
// bình ngưng SJAE). CHỈ import @idtp/sdk. Hai hệ "hoãn" nay bổ sung (v1.43):
//  (1) HÚT KHÍ bình ngưng (SJAE — steam jet air ejector): hút khí không ngưng → giữ O₂ hoà tan thấp.
//      HOẠT ĐỘNG LIÊN TỤC ở tải (van hút khí mở ~mid). Vòng 'sjae-air-removal'.
//  (2) HP TURBINE BYPASS: xả hơi SH → cold reheat khi áp SH VƯỢT ngưỡng cao (18,5 MPa, TRÊN điểm vận hành
//      17,5) — thiết bị KHỞI ĐỘNG/TRIP: đóng ở tải bình thường (van 0), MỞ khi trip turbine đẩy áp lên.
//      Vòng 'hp-bypass-pressure' (reverse). Suất xả = van × cap → BLR_HP_BYPASS_FLOW_01.
//  (3) LP TURBINE BYPASS (v1.44): xả hot reheat → BÌNH NGƯNG khi áp reheat VƯỢT ngưỡng (4,0 MPa, TRÊN điểm
//      vận hành HRH 3,8) — KHỞI ĐỘNG/TRIP: đóng ở tải (van 0), MỞ khi trip đẩy áp reheat lên. Vòng
//      'lp-bypass-pressure' (reverse). Suất xả = van × cap → TRB_LP_BYPASS_FLOW_01.
// ADDITIVE — đọc áp SH/reheat + van (do ControlLoopEngine ghi), sinh tag O₂/bypass ĐỘC LẬP. Tất định. Không
// ghi đè tag boiler/turbine (van bypass KHÔNG trừ hơi turbine ở điểm vận hành vì = 0 → 0 hồi quy). GĐ-94/97.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const O2_BASE_PPB = 25; // O₂ hoà tan condensate khi KHÔNG hút khí (khí lọt vào)
const K_SJAE_PPB = 25; // giảm O₂ toàn hành trình van SJAE (hút khí)
const HP_BYPASS_CAP_TPH = 800; // suất xả HP bypass toàn hành trình (van 100% → cold reheat)
const LP_BYPASS_CAP_TPH = 1200; // suất xả LP bypass toàn hành trình (van 100% → bình ngưng, hot reheat)

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class BypassAirRemovalModel implements ISimModel {
  readonly id = 'thermal-bypass-airremoval';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'COND_O2_01', // ppb — O₂ hoà tan condensate (SJAE giữ thấp)
    'COND_AIR_INLEAK_01', // %/nền — chỉ số khí lọt (tham chiếu, nền không đổi)
    'BLR_HP_BYPASS_FLOW_01', // t/h — lưu lượng xả HP bypass (0 ở tải, > 0 khi trip đẩy áp SH lên)
    'BLR_HP_BYPASS_OPEN_01', // % — độ mở van HP bypass (echo để mimic hiển thị)
    'TRB_LP_BYPASS_FLOW_01', // t/h — lưu lượng xả LP bypass (hot reheat → bình ngưng; 0 ở tải, > 0 khi trip đẩy áp reheat lên)
    'TRB_LP_BYPASS_OPEN_01', // % — độ mở van LP bypass (echo để mimic hiển thị)
  ];

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    // không giữ trạng thái (đại số từ van + áp; đầu vào đã có quán tính)
  }

  step(ctx: ISimModelContext): ISimStepResult {
    // (1) SJAE hút khí: van hút khí (do vòng sjae-air-removal ghi) → O₂ = nền − hút khí. Van cao → O₂ thấp.
    const sjaeValve = clamp(ctx.getTag('COND_SJAE_VALVE_01'), 0, 100);
    const o2 = clamp(O2_BASE_PPB - K_SJAE_PPB * (sjaeValve / 100), 0, O2_BASE_PPB);

    // (2) HP bypass: van (do vòng hp-bypass-pressure ghi) → lưu lượng xả. Ở tải bình thường van = 0 (áp SH
    // 17,5 < ngưỡng 18,5) → xả 0. Khi trip turbine đẩy áp SH lên > 18,5 → van mở → xả hơi bảo vệ lò.
    const bypassValve = clamp(ctx.getTag('BLR_HP_BYPASS_VALVE_01'), 0, 100);
    const bypassFlow = (bypassValve / 100) * HP_BYPASS_CAP_TPH;

    // (3) LP bypass: van (do vòng lp-bypass-pressure ghi) → lưu lượng xả hot reheat → bình ngưng. Ở tải bình
    // thường van = 0 (áp HRH 3,8 < ngưỡng 4,0) → xả 0. Khi trip đẩy áp reheat > 4,0 → van mở → xả hơi tái nhiệt.
    const lpValve = clamp(ctx.getTag('TRB_LP_BYPASS_VALVE_01'), 0, 100);
    const lpFlow = (lpValve / 100) * LP_BYPASS_CAP_TPH;

    return {
      outputs: [
        { tagId: 'COND_O2_01', value: o2, quality: 'Good' },
        { tagId: 'COND_AIR_INLEAK_01', value: O2_BASE_PPB, quality: 'Good' },
        { tagId: 'BLR_HP_BYPASS_FLOW_01', value: bypassFlow, quality: 'Good' },
        { tagId: 'BLR_HP_BYPASS_OPEN_01', value: bypassValve, quality: 'Good' },
        { tagId: 'TRB_LP_BYPASS_FLOW_01', value: lpFlow, quality: 'Good' },
        { tagId: 'TRB_LP_BYPASS_OPEN_01', value: lpValve, quality: 'Good' },
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

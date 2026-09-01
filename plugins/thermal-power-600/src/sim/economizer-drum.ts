// Plugin thermal-power-600 — EconomizerDrumModel (ISimModel, doc 10 §6/§7). Chiều sâu "nội thất" phía
// nước–hơi của lò: BỘ HÂM NƯỚC (economizer) + BAO HƠI (drum internals) + XẢ LÒ (blowdown) + VAN AN TOÀN.
// Đây là các thiết bị nhà máy thật LUÔN có nhưng twin chưa mô hình hoá (bảng GAP hệ #1, WORKFLOW-SYSTEM-BUILD).
// CHỈ import @idtp/sdk.
//
// Bốn cụm hiện tượng được mô hình hoá:
//  1) ECONOMIZER — nước cấp 283 °C được hâm bằng khói ra khỏi lò. Bề mặt trao đổi nhiệt CỐ ĐỊNH nên khi
//     tải giảm, thời gian lưu tăng → hiệu quả trao đổi TĂNG → nước ra càng SÁT nhiệt bão hoà. "Approach to
//     saturation" co lại ở tải thấp là rủi ro vận hành thật: nước SÔI ngay trong economizer (steaming) gây
//     búa nước và mất ổn định cấp nước. Twin phải nhìn thấy được biên này.
//  2) BAO HƠI — áp bao hơi = áp hơi chính + tổn thất áp qua bộ quá nhiệt (∝ lưu lượng²). Từ áp bao hơi suy
//     ra nhiệt BÃO HOÀ, và độ QUÁ NHIỆT của hơi chính = nhiệt hơi − nhiệt bão hoà tại áp hơi chính.
//  3) ĐO MỨC DỰ PHÒNG — nhà máy thật đo mức bao hơi bằng nhiều bộ độc lập. Sai số cột nước đối chứng
//     (reference leg) đổi theo áp suất → hai bộ lệch nhau; DCS so lệch và chọn giá trị dùng.
//  4) XẢ LÒ + VAN AN TOÀN — chất rắn/silica vào theo nước cấp, CHỈ ra theo đường xả (hơi không mang đi).
//     Nồng độ bao hơi là bài toán bình khuấy: cân bằng giữa mang vào và xả ra ⇒ "số lần cô đặc" = Ffw/Fbd.
//     Van an toàn bao hơi là lớp bảo vệ quá áp cuối cùng — theo dõi BIÊN tới áp đặt.
//
// ADDITIVE — đọc tag đã có (áp/nhiệt hơi chính, mức bao hơi, lưu lượng nước cấp/hơi, nhiệt nước vào
// economizer, van xả) → sinh tag MỚI, KHÔNG đổi tag lõi ⇒ 0 hồi quy. Tất định (không Math.random/Date.now).
// Đăng ký SAU BoilerIslandModel và FeedwaterTrainModel để đọc số tươi cùng bước.
//
// Neo Design Basis (Phụ lục A §3.2): BMCR 2.008 t/h · hơi chính 17,5 MPa(g)/541 °C · áp bao hơi 18,9 MPa ·
// nước cấp vào economizer 283 °C · mức bao hơi 0 mm ± 50. Số ngoài design basis → [GIẢ ĐỊNH] GĐ-161.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

// --- Neo Design Basis ---
const BMCR_TPH = 2008; // t/h — lưu lượng hơi BMCR (Phụ lục A §3.2)
const DRUM_PRESS_DESIGN_MPA = 18.9; // MPa(a) — áp bao hơi thiết kế (Phụ lục A §3.2)
const MSTM_PRESS_DESIGN_MPA = 17.5; // MPa — áp hơi chính thiết kế (Phụ lục A §3.2)

// --- Nhiệt bão hoà nước theo áp suất ---
// Xấp xỉ log T_sat(°C) = A + B·ln(P[MPa]), khớp bảng hơi bão hoà trong dải 10–20 MPa (dải vận hành của
// bao hơi 18,9 MPa) với sai số ≤ 0,6 °C. Kiểm chứng: 10 MPa→310,4 (bảng 311,0) · 14→337,0 (336,7) ·
// 18,9→360,7 (360,9) · 20→365,1 (365,7). [GIẢ ĐỊNH] hệ số khớp — GĐ-161.
const T_SAT_A = 128.7;
const T_SAT_B = 78.92;
const T_SAT_P_MIN = 0.5; // MPa — chặn dưới miền hợp lệ (tránh ln của số ≤ 0 lúc khởi động lạnh)

/** Nhiệt độ bão hoà của nước (°C) tại áp suất tuyệt đối P (MPa). Hợp lệ 10–20 MPa (±0,6 °C). */
function satTempC(pMpa: number): number {
  return T_SAT_A + T_SAT_B * Math.log(Math.max(T_SAT_P_MIN, pMpa));
}

// --- Economizer ---
const SH_DP_DESIGN_MPA = DRUM_PRESS_DESIGN_MPA - MSTM_PRESS_DESIGN_MPA; // 1,4 MPa — tổn thất áp qua SH ở BMCR
const ECON_APPROACH_DESIGN_C = 28; // °C — approach to saturation ở BMCR [GIẢ ĐỊNH] GĐ-161
const ECON_APPROACH_EXP = 0.55; // approach ∝ tải^0,55 (bề mặt cố định → tải thấp approach co lại) [GIẢ ĐỊNH]
const ECON_APPROACH_MIN_C = 2; // °C — chặn dưới vật lý (không cho vượt nhiệt bão hoà)
const ECON_STEAMING_APPROACH_C = 6; // °C — dưới mức này coi là có nguy cơ sinh hơi trong economizer [GIẢ ĐỊNH]
const ECON_RISE_MIN_C = 5; // °C — nước ra luôn nóng hơn nước vào (bộ hâm không thể làm mát)
const ECON_DP_DESIGN_KPA = 180; // kPa — tổn thất áp phía nước qua economizer ở BMCR [GIẢ ĐỊNH] GĐ-161

// --- Đo mức bao hơi dự phòng (bộ B) ---
// Bộ đo chênh áp dùng cột nước đối chứng: khi áp suất (⇒ nhiệt bão hoà) lệch khỏi điểm hiệu chuẩn, khối
// lượng riêng nước trong bao hơi đổi → phép đo chưa bù mật độ sinh SAI SỐ tỷ lệ với độ lệch áp.
const LVL_B_CAL_PRESS_MPA = DRUM_PRESS_DESIGN_MPA; // MPa — điểm hiệu chuẩn bộ B
const LVL_B_DENSITY_ERR_MM_PER_MPA = 9; // mm/MPa — sai số cột đối chứng chưa bù mật độ [GIẢ ĐỊNH] GĐ-161
const LVL_DEV_ALARM_MM = 40; // mm — lệch giữa 2 bộ vượt ngưỡng ⇒ nghi hỏng, giữ bộ A [GIẢ ĐỊNH]
const LVL_B_DRIFT_MM = 120; // mm — độ trôi khi hỏng bộ đo B (malfunction)

// --- Xả lò (blowdown) & hoá nước bao hơi ---
const DRUM_WATER_MASS_T = 100; // tấn — khối lượng nước trong bao hơi + vách sinh hơi [GIẢ ĐỊNH] GĐ-161
const FW_COND_US = 0.15; // µS/cm — độ dẫn cation nước cấp (nước siêu tinh khiết) [GIẢ ĐỊNH] GĐ-161
const FW_SILICA_MGL = 0.002; // mg/L — silica nước cấp [GIẢ ĐỊNH] GĐ-161
const CBD_CAP_TPH = 40; // t/h — năng lực van xả liên tục = 2% BMCR [GIẢ ĐỊNH] GĐ-161
const IBD_CAP_TPH = 60; // t/h — năng lực van xả đáy định kỳ [GIẢ ĐỊNH] GĐ-161
const CBD_MIN_TPH = 4; // t/h — xả liên tục tối thiểu (không bao giờ đóng hẳn) [GIẢ ĐỊNH]
const DRUM_COND_TARGET_US = 15; // µS/cm — giới hạn độ dẫn nước bao hơi ở 18,9 MPa [GIẢ ĐỊNH] GĐ-161
const DRUM_SILICA_LIMIT_MGL = 0.2; // mg/L — giới hạn silica nước bao hơi ở 18,9 MPa [GIẢ ĐỊNH] GĐ-161
const MS_PER_HOUR = 3_600_000;

// --- Van an toàn bao hơi (PSV) ---
const PSV1_SET_MPA = 20.4; // MPa(a) — van an toàn thứ nhất [GIẢ ĐỊNH] GĐ-161
const PSV2_SET_MPA = 20.8; // MPa(a) — van an toàn thứ hai [GIẢ ĐỊNH] GĐ-161
const PSV_BLOWDOWN_MPA = 0.6; // MPa — độ chênh đóng lại (blowdown) của van an toàn [GIẢ ĐỊNH]
const PSV_RELIEF_EACH_TPH = 0.35 * BMCR_TPH; // t/h — năng lực xả mỗi van (35% BMCR) [GIẢ ĐỊNH] GĐ-161
const PSV_STUCK_LEAK_TPH = 60; // t/h — rò khi van an toàn kẹt không đóng lại [GIẢ ĐỊNH]

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class EconomizerDrumModel implements ISimModel {
  readonly id = 'thermal-economizer-drum';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    // Bao hơi — áp & nhiệt bão hoà
    'BLR_DRUM_PRESS_01', // MPa(a) — áp suất bao hơi
    'BLR_DRUM_SAT_TEMP_01', // °C — nhiệt bão hoà tại áp bao hơi
    'BLR_SH_DP_01', // MPa — tổn thất áp qua bộ quá nhiệt (bao hơi → hơi chính)
    'BLR_MSTM_SUPERHEAT_01', // °C — độ quá nhiệt hơi chính
    // Economizer
    'BLR_ECON_OUT_TEMP_01', // °C — nhiệt nước ra bộ hâm
    'BLR_ECON_RISE_01', // °C — độ tăng nhiệt qua bộ hâm
    'BLR_ECON_APPROACH_01', // °C — khoảng cách tới nhiệt bão hoà (approach to saturation)
    'BLR_ECON_DP_01', // kPa — tổn thất áp phía nước qua bộ hâm
    'BLR_ECON_STEAMING_01', // 0/1 — nguy cơ sinh hơi trong bộ hâm
    // Đo mức dự phòng
    'BLR_DRUM_LEVEL_B_01', // mm — mức bao hơi, bộ đo B (độc lập)
    'BLR_DRUM_LEVEL_DEV_01', // mm — sai lệch giữa hai bộ đo
    'BLR_DRUM_LEVEL_SEL_01', // mm — mức được DCS chọn dùng
    'BLR_DRUM_LEVEL_BAD_01', // 0/1 — hai bộ đo lệch quá ngưỡng (nghi hỏng)
    // Xả lò & hoá nước
    'BLR_DRUM_COND_01', // µS/cm — độ dẫn nước bao hơi
    'BLR_DRUM_SILICA_01', // mg/L — silica nước bao hơi
    'BLR_CBD_FLOW_01', // t/h — lưu lượng xả liên tục
    'BLR_IBD_FLOW_01', // t/h — lưu lượng xả đáy định kỳ
    'BLR_BD_TOTAL_PCT_01', // % — tổng xả so với lưu lượng nước cấp
    'BLR_CYCLES_CONC_01', // — số lần cô đặc (nước cấp / xả)
    // Van an toàn
    'BLR_PSV_MARGIN_01', // MPa — biên áp tới van an toàn thứ nhất
    'BLR_PSV_LIFTED_01', // 0/1/2 — số van an toàn đang mở
    'BLR_PSV_RELIEF_FLOW_01', // t/h — lưu lượng xả qua van an toàn
    // Roll-up
    'BLR_DRUM_HEALTHY_01', // 0/1 — bao hơi + bộ hâm + hoá nước bình thường
  ];

  // Trạng thái tích luỹ (bình khuấy hoá nước) — khởi tạo ở điểm cân bằng để không có quá độ giả lúc mở máy.
  private condUs = FW_COND_US;
  private silicaMgl = FW_SILICA_MGL;
  private psvLatched = 0; // số van đang mở (có nhớ, đóng lại theo blowdown áp)
  private lvlBFail = false;
  private psvStuck = false;
  private seeded = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.condUs = FW_COND_US;
    this.silicaMgl = FW_SILICA_MGL;
    this.psvLatched = 0;
    this.lvlBFail = false;
    this.psvStuck = false;
    this.seeded = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    // ---------- Đầu vào (tag đã có) ----------
    const mstmPress = Math.max(0, ctx.getTag('BLR_MSTM_SH_PRESS_01')); // MPa
    const mstmTemp = ctx.getTag('BLR_MSTM_SH_TEMP_01'); // °C
    const steamFlow = Math.max(0, ctx.getTag('BLR_STEAM_FLOW_01')); // t/h
    const fwFlow = Math.max(0, ctx.getTag('BLR_FW_FLOW_01')); // t/h
    const levelA = ctx.getTag('BLR_DRUM_LEVEL_01'); // mm
    const econIn = ctx.getTag('FW_ECON_INLET_TEMP_01'); // °C (FeedwaterTrainModel)
    const cbdValve = clamp(ctx.getTag('BLR_CBD_VALVE_01'), 0, 100); // % (vòng blowdown)
    const ibdValve = clamp(ctx.getTag('BLR_IBD_VALVE_01'), 0, 100); // % (thao tác định kỳ)

    const loadFrac = clamp(steamFlow / BMCR_TPH, 0, 1.2);

    // ---------- 1) Bao hơi: áp suất & nhiệt bão hoà ----------
    // Tổn thất áp qua bộ quá nhiệt tỷ lệ lưu lượng² (dòng rối trong ống).
    const shDp = SH_DP_DESIGN_MPA * loadFrac * loadFrac;
    const drumPress = mstmPress + shDp;
    const drumSat = satTempC(drumPress);
    // Độ quá nhiệt hơi chính lấy nhiệt bão hoà TẠI ÁP HƠI CHÍNH (không phải áp bao hơi).
    const superheat = Math.max(0, mstmTemp - satTempC(mstmPress));

    // ---------- 2) Economizer ----------
    // Bề mặt cố định: tải giảm → hiệu quả tăng → approach co lại (nguy cơ sinh hơi ở tải thấp).
    const approachRaw = ECON_APPROACH_DESIGN_C * Math.pow(Math.max(0.05, loadFrac), ECON_APPROACH_EXP);
    // Nước ra không thể vượt bão hoà, cũng không thể lạnh hơn nước vào.
    const econOutCap = drumSat - ECON_APPROACH_MIN_C;
    const econOut = clamp(drumSat - approachRaw, Math.min(econIn + ECON_RISE_MIN_C, econOutCap), econOutCap);
    const approach = drumSat - econOut;
    const econRise = econOut - econIn;
    const econDp = ECON_DP_DESIGN_KPA * Math.pow(clamp(fwFlow / BMCR_TPH, 0, 1.2), 2);
    const steaming = approach < ECON_STEAMING_APPROACH_C;

    // ---------- 3) Đo mức bao hơi: bộ B độc lập + so lệch ----------
    const densityErr = (drumPress - LVL_B_CAL_PRESS_MPA) * LVL_B_DENSITY_ERR_MM_PER_MPA;
    const levelB = levelA + densityErr + (this.lvlBFail ? LVL_B_DRIFT_MM : 0);
    const levelDev = Math.abs(levelA - levelB);
    const levelBad = levelDev > LVL_DEV_ALARM_MM;
    // DCS: lệch nhỏ → trung bình hai bộ (giảm nhiễu); lệch lớn → giữ bộ A (bộ đã bù mật độ).
    const levelSel = levelBad ? levelA : (levelA + levelB) / 2;

    // ---------- 4) Xả lò & hoá nước bao hơi ----------
    const cbdFlow = CBD_MIN_TPH + (cbdValve / 100) * (CBD_CAP_TPH - CBD_MIN_TPH);
    const ibdFlow = (ibdValve / 100) * IBD_CAP_TPH;
    const bdTotal = cbdFlow + ibdFlow;
    // Bình khuấy: chất rắn vào theo nước cấp, ra CHỈ theo đường xả (hơi bão hoà mang đi không đáng kể).
    //   dC/dt = (C_fw·F_fw − C·F_bd) / M      [F: t/h, M: t ⇒ dt tính bằng giờ]
    const dtH = ctx.dtMs / MS_PER_HOUR;
    if (!this.seeded) {
      // Nạp thẳng điểm cân bằng ứng với chế độ hiện tại: hằng số thời gian M/F_bd ≈ 5 h, nếu bắt đầu từ
      // nước tinh khiết thì OTS phải chạy nửa ngày mới tới chế độ — không phục vụ huấn luyện.
      const cyc0 = bdTotal > 0 ? fwFlow / bdTotal : 1;
      this.condUs = FW_COND_US * Math.max(1, cyc0);
      this.silicaMgl = FW_SILICA_MGL * Math.max(1, cyc0);
      this.seeded = true;
    }
    const dCond = ((FW_COND_US * fwFlow - this.condUs * bdTotal) / DRUM_WATER_MASS_T) * dtH;
    const dSil = ((FW_SILICA_MGL * fwFlow - this.silicaMgl * bdTotal) / DRUM_WATER_MASS_T) * dtH;
    this.condUs = Math.max(FW_COND_US, this.condUs + dCond);
    this.silicaMgl = Math.max(FW_SILICA_MGL, this.silicaMgl + dSil);
    const cycles = bdTotal > 0 ? fwFlow / bdTotal : 0;
    const bdPct = fwFlow > 0 ? (bdTotal / fwFlow) * 100 : 0;

    // ---------- 5) Van an toàn bao hơi ----------
    // Có nhớ: mở khi vượt áp đặt, chỉ đóng lại khi áp tụt dưới (áp đặt − blowdown). Van kẹt → rò liên tục.
    let lifted = this.psvLatched;
    if (drumPress >= PSV2_SET_MPA) lifted = 2;
    else if (drumPress >= PSV1_SET_MPA) lifted = Math.max(lifted, 1);
    if (lifted >= 2 && drumPress < PSV2_SET_MPA - PSV_BLOWDOWN_MPA) lifted = 1;
    if (lifted >= 1 && drumPress < PSV1_SET_MPA - PSV_BLOWDOWN_MPA) lifted = 0;
    this.psvLatched = lifted;
    const psvMargin = PSV1_SET_MPA - drumPress;
    const reliefFlow = lifted * PSV_RELIEF_EACH_TPH + (this.psvStuck ? PSV_STUCK_LEAK_TPH : 0);

    // ---------- Roll-up sức khoẻ ----------
    const healthy =
      !steaming &&
      !levelBad &&
      lifted === 0 &&
      !this.psvStuck &&
      this.condUs <= DRUM_COND_TARGET_US &&
      this.silicaMgl <= DRUM_SILICA_LIMIT_MGL;

    return {
      outputs: [
        { tagId: 'BLR_DRUM_PRESS_01', value: drumPress, quality: 'Good' },
        { tagId: 'BLR_DRUM_SAT_TEMP_01', value: drumSat, quality: 'Good' },
        { tagId: 'BLR_SH_DP_01', value: shDp, quality: 'Good' },
        { tagId: 'BLR_MSTM_SUPERHEAT_01', value: superheat, quality: 'Good' },
        { tagId: 'BLR_ECON_OUT_TEMP_01', value: econOut, quality: 'Good' },
        { tagId: 'BLR_ECON_RISE_01', value: econRise, quality: 'Good' },
        { tagId: 'BLR_ECON_APPROACH_01', value: approach, quality: 'Good' },
        { tagId: 'BLR_ECON_DP_01', value: econDp, quality: 'Good' },
        { tagId: 'BLR_ECON_STEAMING_01', value: steaming ? 1 : 0, quality: 'Good' },
        { tagId: 'BLR_DRUM_LEVEL_B_01', value: levelB, quality: 'Good' },
        { tagId: 'BLR_DRUM_LEVEL_DEV_01', value: levelDev, quality: 'Good' },
        { tagId: 'BLR_DRUM_LEVEL_SEL_01', value: levelSel, quality: 'Good' },
        { tagId: 'BLR_DRUM_LEVEL_BAD_01', value: levelBad ? 1 : 0, quality: 'Good' },
        { tagId: 'BLR_DRUM_COND_01', value: this.condUs, quality: 'Good' },
        { tagId: 'BLR_DRUM_SILICA_01', value: this.silicaMgl, quality: 'Good' },
        { tagId: 'BLR_CBD_FLOW_01', value: cbdFlow, quality: 'Good' },
        { tagId: 'BLR_IBD_FLOW_01', value: ibdFlow, quality: 'Good' },
        { tagId: 'BLR_BD_TOTAL_PCT_01', value: bdPct, quality: 'Good' },
        { tagId: 'BLR_CYCLES_CONC_01', value: cycles, quality: 'Good' },
        { tagId: 'BLR_PSV_MARGIN_01', value: psvMargin, quality: 'Good' },
        { tagId: 'BLR_PSV_LIFTED_01', value: lifted, quality: 'Good' },
        { tagId: 'BLR_PSV_RELIEF_FLOW_01', value: reliefFlow, quality: 'Good' },
        { tagId: 'BLR_DRUM_HEALTHY_01', value: healthy ? 1 : 0, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return {
      state: {
        condUs: this.condUs,
        silicaMgl: this.silicaMgl,
        psvLatched: this.psvLatched,
        lvlBFail: this.lvlBFail ? 1 : 0,
        psvStuck: this.psvStuck ? 1 : 0,
        seeded: this.seeded ? 1 : 0,
      },
    };
  }

  restore(snapshot: ISimSnapshot): void {
    this.condUs = snapshot.state.condUs ?? FW_COND_US;
    this.silicaMgl = snapshot.state.silicaMgl ?? FW_SILICA_MGL;
    this.psvLatched = snapshot.state.psvLatched ?? 0;
    this.lvlBFail = (snapshot.state.lvlBFail ?? 0) > 0.5;
    this.psvStuck = (snapshot.state.psvStuck ?? 0) > 0.5;
    this.seeded = (snapshot.state.seeded ?? 0) > 0.5;
  }

  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'drum-level-tx-b-drift') this.lvlBFail = true;
    if (m.id === 'drum-psv-stuck-open') this.psvStuck = true;
    if (m.id === 'drum-blowdown-blocked') {
      // Đường xả tắc → chất rắn không thoát ra: đẩy thẳng nồng độ lên trên giới hạn để lộ hậu quả
      // ngay trong phiên huấn luyện (hằng số thời gian thật ~5 h, quá dài cho một ca OTS).
      this.condUs = DRUM_COND_TARGET_US * 1.6;
      this.silicaMgl = DRUM_SILICA_LIMIT_MGL * 1.6;
    }
  }

  clearMalfunction(id: string): void {
    if (id === 'drum-level-tx-b-drift') this.lvlBFail = false;
    if (id === 'drum-psv-stuck-open') this.psvStuck = false;
    if (id === 'drum-blowdown-blocked') this.seeded = false; // nạp lại điểm cân bằng ở bước kế
  }

  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

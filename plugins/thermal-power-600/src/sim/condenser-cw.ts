// Plugin thermal-power-600 — CondenserCWModel (ISimModel, doc 10 §6 — bình ngưng + nước tuần hoàn CW).
// CHỈ import @idtp/sdk. CHIỀU SÂU vật lý bổ sung (v1.20), chạy CẠNH boiler/turbine/reheat/feedwater:
// đọc công suất/heat rate chu trình/chân không tươi → CÂN BẰNG NĂNG LƯỢNG bình ngưng (nhiệt thải =
// nhiệt cấp − công suất) → sinh tag phía CW (lưu lượng, nhiệt vào/ra, độ tăng nhiệt, TTD, sat temp).
// ADDITIVE — KHÔNG ghi đè TRB_COND_VACUUM_01 (boiler sở hữu); chỉ ĐỌC để suy nhiệt bão hoà. Tất định.
//
// Neo Design Basis (Phụ lục A): nước tuần hoàn CW 64.000 m³/h · chân không 5,4 kPa(a) → sat ~34 °C ·
// tháp làm mát natural draft · 600 MW. Nhiệt thải suy từ heat rate chu trình đã dựng (v1.19). TTD, cp,
// tương quan sat-temp, τ CW = [GIẢ ĐỊNH] (GĐ-67). Lưu ý: 5,4 kPa ⇒ CW vào ~19 °C (ôn hoà) — vận hành
// nhiệt đới (CW vào cao hơn) sẽ đẩy back-pressure lên; là cảnh báo hiệu năng thật, nêu rõ.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

/* ── Design Basis (Phụ lục A) ── */
const CW_FLOW_TPH = 64000; // 64.000 m³/h ≈ 64.000 t/h nước
const VACUUM_NOM_KPA = 5.4;

/* ── [GIẢ ĐỊNH] hiệu chỉnh (GĐ-67) ── */
const TTD_NOM_C = 2.8; // terminal temperature difference bình ngưng
const CP_CW_KJKGK = 4.18; // nhiệt dung riêng nước làm mát
const TAU_CW_S = 20; // quán tính nhiệt vòng CW
const HOTWELL_STORAGE_T = 250; // sức chứa hotwell (t) — quy mô mức % [GIẢ ĐỊNH] GĐ-80
const CEP_MAX_TPH = 2200; // lưu lượng bơm ngưng (CEP) tối đa (LCV 100%)
/* ── Nước làm mát khép kín phụ trợ (closed cooling water — CCW) — GĐ-88 ── */
const MW_GROSS = 600;
const T_CCW_MIN_C = 30; // nhiệt CCW nền (approach tới CW chính)
const K_CCW_HEAT_C = 18; // °C tăng CCW theo tải (tải nhiệt phụ trợ: dầu, H₂, stator, mẫu)
const K_CCW_COOL_C = 15; // °C giảm toàn hành trình van CW cấp bộ trao đổi nhiệt CCW

const CW_KGS = (CW_FLOW_TPH * 1000) / 3600; // ~17.778 kg/s

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
// Nhiệt bão hoà hơi ở áp thấp (kPa) — tương quan neo 5,4 kPa→34 °C, 10 kPa→45,8 °C [GIẢ ĐỊNH].
function satTempC(kpa: number): number {
  return clamp(1.8 + 19.1 * Math.log(Math.max(0.5, kpa)), 10, 100);
}

export class CondenserCWModel implements ISimModel {
  readonly id = 'thermal-condenser-cw';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'COND_DUTY_01', // MWth — nhiệt thải ra bình ngưng (cân bằng năng lượng)
    'COND_SAT_TEMP_01', // °C — nhiệt bão hoà ứng chân không
    'COND_TTD_01', // °C — terminal temperature difference
    'COND_CW_FLOW_01', // t/h — lưu lượng nước tuần hoàn
    'COND_CW_IN_TEMP_01', // °C — CW vào (từ tháp làm mát)
    'COND_CW_OUT_TEMP_01', // °C — CW ra (về tháp làm mát)
    'COND_CW_RISE_01', // °C — độ tăng nhiệt CW qua bình ngưng
    // Chiều sâu SCADA: 2 bơm nước tuần hoàn (A/B, mỗi bơm 50% lưu lượng CW) — chia đôi tổng đã tính.
    'COND_CWP_A_FLOW_01',
    'COND_CWP_B_FLOW_01',
    'COND_HOTWELL_LEVEL_01', // % — mức hotwell (điều khiển bằng bơm ngưng CEP)
    'COND_CCW_TEMP_01', // °C — nhiệt nước làm mát khép kín phụ trợ (van CW bộ trao đổi CCW giữ 38 °C)
  ];

  private tCwOut = 31;
  private tCwIn = 19;
  private cwPumpTripped = false; // malfunction: trip 1 bơm CW → còn 50% lưu lượng → độ tăng nhiệt gấp đôi
  private hotwellLevel = 50; // % — mức hotwell (tích phân ngưng tụ vào − bơm ngưng ra)

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.tCwOut = 31;
    this.tCwIn = 19;
    this.cwPumpTripped = false;
    this.hotwellLevel = 50;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dt = ctx.dtMs / 1000;
    const mw = Math.max(0, ctx.getTag('GEN_MW_01')); // MW gross
    const hr = Math.max(0, ctx.getTag('PLANT_CYCLE_HR_01')); // kJ/kWh — heat rate chu trình (v1.19)
    const vacuum = Math.max(0, ctx.getTag('TRB_COND_VACUUM_01')); // kPa(a) — CHỈ đọc

    // Cân bằng năng lượng bình ngưng: nhiệt CẤP cho chu trình = HR·gross; nhiệt THẢI = cấp − công suất.
    const qInMw = (hr * mw) / 3600; // MWth (= HR[kJ/kWh]·mw[MW]·1000/3600/1000)
    const qRejMw = Math.max(0, qInMw - mw);

    // Mức hotwell: tích phân (ngưng tụ VÀO ≈ hơi − bơm ngưng CEP RA). Loop 'hotwell-level' điều CEP LCV
    // giữ mức 50%. Ở ổn định: ngưng tụ vào = bơm ngưng ra = hơi → mức đứng yên.
    const steam = Math.max(0, ctx.getTag('BLR_STEAM_FLOW_01'));
    const cepFlow = (clamp(ctx.getTag('COND_CEP_LCV_01'), 0, 100) / 100) * CEP_MAX_TPH;
    this.hotwellLevel = clamp(this.hotwellLevel + ((steam - cepFlow) / HOTWELL_STORAGE_T) * 100 * (dt / 3600), 0, 100);

    // Độ tăng nhiệt CW từ nhiệt thải và lưu lượng CW: ΔT = Q/(ṁ·cp). Trip 1 bơm → còn 50% lưu lượng.
    const cwFlowTph = this.cwPumpTripped ? CW_FLOW_TPH / 2 : CW_FLOW_TPH;
    const cwKgs = (cwFlowTph * 1000) / 3600;
    const rise = qRejMw > 0 ? (qRejMw * 1000) / (cwKgs * CP_CW_KJKGK) : 0;

    // Nhiệt bão hoà ứng chân không hiện tại; CW ra = sat − TTD; CW vào = ra − ΔT.
    const tSat = satTempC(vacuum > 0 ? vacuum : VACUUM_NOM_KPA);
    const outTarget = tSat - TTD_NOM_C;
    const inTarget = outTarget - rise;
    this.tCwOut += (outTarget - this.tCwOut) * (dt / TAU_CW_S);
    this.tCwIn += (inTarget - this.tCwIn) * (dt / TAU_CW_S);

    // Nước làm mát khép kín phụ trợ (CCW): thu nhiệt các cooler phụ (dầu bôi trơn, H₂, stator, mẫu) ∝ tải →
    // thải qua bộ trao đổi nhiệt về CW chính. Loop 'closed-cooling-water-temp' điều van CW cấp cho bộ trao
    // đổi (reverse: CCW nóng → mở thêm) giữ 38 °C. Derived thuần (gain nhỏ ổn định, không cần quán tính).
    const ccwValve = clamp(ctx.getTag('COND_CCW_CW_VALVE_01'), 0, 100);
    const ccwTemp = T_CCW_MIN_C + K_CCW_HEAT_C * clamp(mw / MW_GROSS, 0, 1) - K_CCW_COOL_C * (ccwValve / 100);

    return {
      outputs: [
        { tagId: 'COND_DUTY_01', value: qRejMw, quality: 'Good' },
        { tagId: 'COND_SAT_TEMP_01', value: tSat, quality: 'Good' },
        { tagId: 'COND_TTD_01', value: TTD_NOM_C, quality: 'Good' },
        { tagId: 'COND_CW_FLOW_01', value: cwFlowTph, quality: 'Good' },
        { tagId: 'COND_CW_IN_TEMP_01', value: this.tCwIn, quality: 'Good' },
        { tagId: 'COND_CW_OUT_TEMP_01', value: this.tCwOut, quality: 'Good' },
        { tagId: 'COND_CW_RISE_01', value: rise, quality: 'Good' },
        // Trip 1 bơm → bơm A dừng (0), bơm B gánh 50% tổng; bình thường mỗi bơm 50%.
        { tagId: 'COND_CWP_A_FLOW_01', value: this.cwPumpTripped ? 0 : CW_FLOW_TPH / 2, quality: 'Good' },
        { tagId: 'COND_CWP_B_FLOW_01', value: CW_FLOW_TPH / 2, quality: 'Good' },
        { tagId: 'COND_HOTWELL_LEVEL_01', value: this.hotwellLevel, quality: 'Good' },
        { tagId: 'COND_CCW_TEMP_01', value: ccwTemp, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { tCwOut: this.tCwOut, tCwIn: this.tCwIn, cwPumpTripped: this.cwPumpTripped ? 1 : 0, hotwellLevel: this.hotwellLevel } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.tCwOut = snapshot.state.tCwOut ?? 31;
    this.tCwIn = snapshot.state.tCwIn ?? 19;
    this.cwPumpTripped = (snapshot.state.cwPumpTripped ?? 0) > 0;
    this.hotwellLevel = snapshot.state.hotwellLevel ?? 50;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'cw-pump-trip') this.cwPumpTripped = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'cw-pump-trip') this.cwPumpTripped = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

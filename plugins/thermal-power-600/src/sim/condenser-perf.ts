// Plugin thermal-power-600 — CondenserPerfModel (ISimModel, doc 10 §6 — hiệu năng bình ngưng & back-pressure).
// CHỈ import @idtp/sdk. CHIỀU SÂU: đường cong BACK-PRESSURE theo nhiệt CW vào + tải + ĐỘ SẠCH ống. Nhiệt CW ra
// = CW vào + độ tăng (∝ tải); nhiệt bão hoà ngưng = CW ra + TTD (terminal temp diff); TTD xấu đi khi ống BÁM
// BẨN (cleanliness giảm) → nhiệt bão hoà tăng → back-pressure tăng → PHẠT heat rate. Mô hình QUAN HỆ (deviation
// so nền sạch tại tải hiện tại) → tránh vướng tranh cãi áp tuyệt đối (5,4 kPa thiết kế vs CW nhiệt đới, GĐ-71).
//
// ADDITIVE — sinh tag CNDP_* ĐỘC LẬP; KHÔNG đổi TRB_COND_VACUUM_01 lõi (0 hồi quy). Penalty là ƯỚC LƯỢNG chẩn
// đoán, TÁCH khỏi heat rate lõi (M-06). Tất định (không Math.random). Có TRẠNG THÁI (độ sạch tích luỹ) →
// snapshot/restore. Malfunction: 'condenser-tube-fouling' (độ sạch giảm dần → TTD xấu → BP tăng) ·
// 'cw-temp-high' (CW vào tăng → BP tăng).
//
// Neo Design Basis (Phụ lục A §3.2): CW vào ~31 °C (bầu ướt nhiệt đới), độ tăng CW ~9 °C đầy tải, TTD sạch
// ~3 °C. Hệ số BP/nhiệt bão hoà, penalty/kPa, tốc độ bám ống = [GIẢ ĐỊNH].
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const CW_NOM_C = 31; // °C — nhiệt CW vào danh định
const CW_RISE_FULL_C = 9; // °C — độ tăng nhiệt CW đầy tải
const TTD_CLEAN_C = 3; // °C — TTD ống sạch
const CW_HIGH_OFFSET_C = 6; // °C — CW vào tăng khi sự cố
const K_BP_KPA_PER_C = 0.3; // kPa back-pressure / °C nhiệt bão hoà tăng
const K_HR_PCT_PER_KPA = 1.5; // % heat rate / kPa back-pressure vượt nền
const FOUL_RATE_PER_MIN = 6; // %/phút độ sạch giảm khi bám ống (demo — bám ống thật chậm hơn nhiều)
const CLEANLINESS_FLOOR = 55; // % — sàn độ sạch
const BP_DEV_HEALTHY_KPA = 1.5; // kPa — lệch back-pressure lành mạnh
const CLEAN_HEALTHY_MIN = 80; // % — độ sạch lành mạnh

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class CondenserPerfModel implements ISimModel {
  readonly id = 'thermal-condenser-perf';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'CNDP_CW_INLET_01', // °C — nhiệt CW vào
    'CNDP_CW_OUTLET_01', // °C — nhiệt CW ra
    'CNDP_CW_RISE_01', // °C — độ tăng nhiệt CW
    'CNDP_CLEANLINESS_01', // % — độ sạch ống
    'CNDP_TTD_01', // °C — terminal temp difference
    'CNDP_SAT_TEMP_01', // °C — nhiệt bão hoà ngưng
    'CNDP_BP_DEVIATION_01', // kPa — lệch back-pressure so nền sạch
    'CNDP_HR_PENALTY_01', // % — phạt heat rate ước lượng
    'CNDP_HEALTHY_01', // 0/1 — bình ngưng bình thường
  ];

  private cleanliness = 100; // %
  private fouling = false;
  private cwHigh = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.cleanliness = 100;
    this.fouling = false;
    this.cwHigh = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dtMin = ctx.dtMs / 60_000;
    const loadFrac = clamp(Math.max(0, ctx.getTag('GEN_MW_01')) / 600, 0, 1.1);
    const cwSupply = ctx.getTag('CT_CW_SUPPLY_01') || CW_NOM_C;

    // Bám ống: độ sạch giảm dần khi sự cố.
    if (this.fouling) this.cleanliness = clamp(this.cleanliness - FOUL_RATE_PER_MIN * dtMin, CLEANLINESS_FLOOR, 100);

    const cwIn = (this.cwHigh ? cwSupply + CW_HIGH_OFFSET_C : cwSupply);
    const cwRise = CW_RISE_FULL_C * loadFrac;
    const cwOut = cwIn + cwRise;
    const ttd = TTD_CLEAN_C * (100 / this.cleanliness); // độ sạch giảm → TTD tăng
    const satTemp = cwOut + ttd;

    // Nền SẠCH tại tải hiện tại (độ sạch 100%, CW danh định) → lệch back-pressure = 0 ở điểm vận hành.
    const satBaseline = CW_NOM_C + cwRise + TTD_CLEAN_C;
    const bpDeviation = Math.max(0, K_BP_KPA_PER_C * (satTemp - satBaseline));
    const hrPenalty = K_HR_PCT_PER_KPA * bpDeviation;
    const healthy = bpDeviation <= BP_DEV_HEALTHY_KPA && this.cleanliness >= CLEAN_HEALTHY_MIN ? 1 : 0;

    return {
      outputs: [
        { tagId: 'CNDP_CW_INLET_01', value: cwIn, quality: 'Good' },
        { tagId: 'CNDP_CW_OUTLET_01', value: cwOut, quality: 'Good' },
        { tagId: 'CNDP_CW_RISE_01', value: cwRise, quality: 'Good' },
        { tagId: 'CNDP_CLEANLINESS_01', value: this.cleanliness, quality: 'Good' },
        { tagId: 'CNDP_TTD_01', value: ttd, quality: 'Good' },
        { tagId: 'CNDP_SAT_TEMP_01', value: satTemp, quality: 'Good' },
        { tagId: 'CNDP_BP_DEVIATION_01', value: bpDeviation, quality: 'Good' },
        { tagId: 'CNDP_HR_PENALTY_01', value: hrPenalty, quality: 'Good' },
        { tagId: 'CNDP_HEALTHY_01', value: healthy, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { cleanliness: this.cleanliness, fouling: this.fouling ? 1 : 0, cwHigh: this.cwHigh ? 1 : 0 } };
  }
  restore(s: ISimSnapshot): void {
    this.cleanliness = s.state.cleanliness ?? 100;
    this.fouling = (s.state.fouling ?? 0) > 0.5;
    this.cwHigh = (s.state.cwHigh ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'condenser-tube-fouling') this.fouling = true;
    if (m.id === 'cw-temp-high') this.cwHigh = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'condenser-tube-fouling') this.fouling = false;
    if (id === 'cw-temp-high') this.cwHigh = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

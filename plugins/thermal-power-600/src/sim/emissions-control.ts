// Plugin thermal-power-600 — EmissionsControlModel (ISimModel, doc 10 §6 — chất lượng ĐIỀU KHIỂN SCR & FGD).
// CHỈ import @idtp/sdk. CHIỀU SÂU điều khiển phát thải: (1) SCR deNOx — tỉ lệ mol NH₃/NOₓ · HOẠT TÍNH xúc tác ·
// độ khử NOₓ · RÒ NH₃ (ammonia slip, ppm — chỉ số then chốt: quá liều hoặc xúc tác chai → slip vọt). (2) FGD
// deSOₓ — pH slurry đá vôi · độ khử SO₂ · tận dụng đá vôi. Đọc lệnh NH₃/slurry + NOₓ/SO₂ tươi → chỉ số chất
// lượng điều khiển + ước lượng đáp ứng khi xúc tác chai / pH tụt (chẩn đoán, TÁCH khỏi tag phát thải lõi).
//
// ADDITIVE — sinh tag ECTL_* ĐỘC LẬP; KHÔNG đổi EMI_* lõi (0 hồi quy). Tất định (không Math.random). Có TRẠNG
// THÁI (hoạt tính xúc tác + offset pH) → snapshot/restore. Malfunction: 'scr-catalyst-deactivation' (hoạt tính
// giảm → khử NOₓ tụt, slip tăng) · 'scr-ammonia-overdose' (dư NH₃ → slip vọt) · 'fgd-ph-low' (pH tụt → khử SO₂ tụt).
//
// Neo Design Basis (Phụ lục A §4): SCR NH₃/NOₓ ~0,6 mol/mol · slip < 3 ppm · pH slurry 5,5–5,7. Hệ số hoạt
// tính/slip/độ khử, tương quan pH–khử SO₂ = [GIẢ ĐỊNH].
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const NH3_RATIO_SCALE = 0.01; // lệnh NH₃ % → tỉ lệ mol NH₃/NOₓ (62% → ~0,62)
const SCR_MAX_REMOVAL = 90; // % — độ khử NOₓ tối đa xúc tác tốt, đủ NH₃
const K_SLIP = 0.32; // ppm / (%dư NH₃ so độ khử) — độ nhạy rò NH₃
const OVERDOSE_RATIO = 0.20; // thêm tỉ lệ NH₃ khi quá liều
const CATALYST_DEACT = 55; // % hoạt tính khi xúc tác chai
const SLIP_HEALTHY_MAX = 3; // ppm — rò NH₃ lành mạnh
const SCR_REMOVAL_HEALTHY_MIN = 45; // % — độ khử NOₓ lành mạnh
const FGD_PH_BASE = 4.5; // pH nền
const FGD_PH_SPAN = 2.0; // pH dải theo lệnh slurry (100% → 6,5)
const FGD_PH_LOW_OFFSET = 1.1; // pH tụt khi sự cố
const K_SO2_PH = 12; // %khử SO₂ / pH quanh nền 5,5
const FGD_REMOVAL_HEALTHY_MIN = 90; // % — độ khử SO₂ lành mạnh
const FGD_PH_HEALTHY_MIN = 5.3; // pH lành mạnh

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class EmissionsControlModel implements ISimModel {
  readonly id = 'thermal-emissions-control';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'ECTL_NH3_RATIO_01', // mol/mol — tỉ lệ NH₃/NOₓ
    'ECTL_SCR_ACTIVITY_01', // % — hoạt tính xúc tác SCR
    'ECTL_SCR_REMOVAL_01', // % — độ khử NOₓ ước lượng
    'ECTL_NH3_SLIP_01', // ppm — rò NH₃
    'ECTL_SCR_HEALTHY_01', // 0/1 — SCR bình thường
    'ECTL_FGD_PH_01', // pH slurry đá vôi
    'ECTL_FGD_REMOVAL_01', // % — độ khử SO₂ ước lượng
    'ECTL_LIMESTONE_UTIL_01', // % — tận dụng đá vôi
    'ECTL_FGD_HEALTHY_01', // 0/1 — FGD bình thường
  ];

  private activity = 100; // %
  private catalystDeact = false;
  private overdose = false;
  private phLow = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.activity = 100;
    this.catalystDeact = false;
    this.overdose = false;
    this.phLow = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const nh3Cmd = clamp(ctx.getTag('EMI_NH3_INJ_01'), 0, 100);
    const slurryCmd = clamp(ctx.getTag('EMI_FGD_SLURRY_01'), 0, 100);

    this.activity = this.catalystDeact ? CATALYST_DEACT : 100;

    // SCR: tỉ lệ NH₃/NOₓ (+ dư khi quá liều) · độ khử = tỉ lệ × hoạt tính · rò NH₃ = phần NH₃ dư không phản ứng.
    const nh3Ratio = nh3Cmd * NH3_RATIO_SCALE + (this.overdose ? OVERDOSE_RATIO : 0);
    const removal = clamp(nh3Ratio * (this.activity / 100) * SCR_MAX_REMOVAL, 0, 92);
    // Rò NH₃: phần NH₃ dư không phản ứng (khuếch đại khi xúc tác chai) + phạt trực tiếp khi CỐ Ý quá liều.
    const slip = clamp((nh3Ratio * 100 - removal) * K_SLIP / (this.activity / 100) + (this.overdose ? 6 : 0), 0, 40);
    const scrHealthy = removal >= SCR_REMOVAL_HEALTHY_MIN && slip <= SLIP_HEALTHY_MAX ? 1 : 0;

    // FGD: pH slurry theo lệnh (− offset khi sự cố) · độ khử SO₂ theo pH · tận dụng đá vôi (pH cao → dư đá vôi).
    const ph = clamp(FGD_PH_BASE + slurryCmd / 100 * FGD_PH_SPAN - (this.phLow ? FGD_PH_LOW_OFFSET : 0), 3, 7);
    const fgdRemoval = clamp(90 + (ph - 5.5) * K_SO2_PH, 40, 99);
    const limestoneUtil = clamp(100 - (ph - 5.5) * 30, 60, 100); // pH cao → dư đá vôi → tận dụng thấp
    const fgdHealthy = fgdRemoval >= FGD_REMOVAL_HEALTHY_MIN && ph >= FGD_PH_HEALTHY_MIN ? 1 : 0;

    return {
      outputs: [
        { tagId: 'ECTL_NH3_RATIO_01', value: nh3Ratio, quality: 'Good' },
        { tagId: 'ECTL_SCR_ACTIVITY_01', value: this.activity, quality: 'Good' },
        { tagId: 'ECTL_SCR_REMOVAL_01', value: removal, quality: 'Good' },
        { tagId: 'ECTL_NH3_SLIP_01', value: slip, quality: 'Good' },
        { tagId: 'ECTL_SCR_HEALTHY_01', value: scrHealthy, quality: 'Good' },
        { tagId: 'ECTL_FGD_PH_01', value: ph, quality: 'Good' },
        { tagId: 'ECTL_FGD_REMOVAL_01', value: fgdRemoval, quality: 'Good' },
        { tagId: 'ECTL_LIMESTONE_UTIL_01', value: limestoneUtil, quality: 'Good' },
        { tagId: 'ECTL_FGD_HEALTHY_01', value: fgdHealthy, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { catalystDeact: this.catalystDeact ? 1 : 0, overdose: this.overdose ? 1 : 0, phLow: this.phLow ? 1 : 0 } };
  }
  restore(s: ISimSnapshot): void {
    this.catalystDeact = (s.state.catalystDeact ?? 0) > 0.5;
    this.overdose = (s.state.overdose ?? 0) > 0.5;
    this.phLow = (s.state.phLow ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'scr-catalyst-deactivation') this.catalystDeact = true;
    if (m.id === 'scr-ammonia-overdose') this.overdose = true;
    if (m.id === 'fgd-ph-low') this.phLow = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'scr-catalyst-deactivation') this.catalystDeact = false;
    if (id === 'scr-ammonia-overdose') this.overdose = false;
    if (id === 'fgd-ph-low') this.phLow = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

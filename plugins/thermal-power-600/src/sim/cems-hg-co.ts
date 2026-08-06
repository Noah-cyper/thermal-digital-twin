// Plugin thermal-power-600 — CemsHgCoModel (ISimModel, doc 10 §6 — CEMS mở rộng: THUỶ NGÂN + CO).
// CHỈ import @idtp/sdk. CHIỀU SÂU phát thải: bổ sung 2 chỉ tiêu CEMS mà EmissionsModel chưa có —
//  • Hg (thuỷ ngân): từ hàm lượng Hg trong than → thu hồi CO-BENEFIT qua ESP+FGD + phun THAN HOẠT TÍNH
//    (ACI); phần Hg⁰ nguyên tố còn lại thoát ống khói (µg/Nm³).
//  • CO (carbon monoxide): sản phẩm CHÁY KHÔNG HẾT — tăng vọt khi O₂ khói THẤP (thiếu gió). Quy về 6% O₂
//    (hiệu chỉnh pháp lý). Suy hiệu suất cháy.
// Đọc than/khói (EmissionsModel)/O₂ → sinh tag CEMS_* độc lập. ADDITIVE (không đổi tag khác, 0 hồi quy).
// Tất định (không Math.random). Malfunction: 'hg-sorbent-loss' (mất ACI → Hg thoát tăng) · 'co-excursion'
// (cháy không hết → CO cao). Ở vận hành bình thường: Hg thu ~90%, CO thấp (~O₂ danh định 3,2%).
//
// Neo Design Basis (Phụ lục A): than bituminous. Hàm lượng Hg than, tỉ lệ thu hồi Hg, tương quan CO–O₂ =
// [GIẢ ĐỊNH] GĐ-113 — số kiểm định CEMS thật thay khi có.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const HG_COAL_GPT = 0.1; // g/tấn — hàm lượng thuỷ ngân trong than (~0,1 ppm)
const HG_CAPTURE_BASE = 0.65; // thu hồi Hg co-benefit ESP+FGD (không ACI)
const HG_CAPTURE_ACI = 0.25; // thu hồi thêm nhờ phun than hoạt tính (ACI)
const ACI_RATE_KGH = 45; // kg/h — suất phun than hoạt tính khi bật
const O2_REF = 3.2; // % — O₂ khói danh định (điểm vận hành)
const O2_CORR = 6; // % — O₂ chuẩn hiệu chỉnh CO (pháp lý)
const CO_BASE_MG = 30; // mg/Nm³ — CO nền ở O₂ danh định (cháy tốt)
const CO_K = 1.0; // hệ số nhạy CO theo thiếu O₂ (mũ)
const CO_EXCURSION_MG = 900; // mg/Nm³ — CO khi sự cố cháy không hết

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class CemsHgCoModel implements ISimModel {
  readonly id = 'thermal-cems-hg-co';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'CEMS_HG_STACK_01', // µg/Nm³ — thuỷ ngân ống khói
    'CEMS_HG_CAPTURE_01', // % — hiệu suất thu hồi Hg (ESP+FGD+ACI)
    'CEMS_HG_RATE_01', // g/h — suất phát thải Hg
    'CEMS_HG_ACI_01', // kg/h — suất phun than hoạt tính (ACI)
    'CEMS_CO_STACK_01', // mg/Nm³ — CO ống khói
    'CEMS_CO_CORRECTED_01', // mg/Nm³ — CO quy về 6% O₂ (pháp lý)
    'CEMS_COMBUSTION_EFF_01', // % — hiệu suất cháy (từ CO)
  ];

  private sorbentLoss = false; // malfunction: mất ACI
  private coExcursion = false; // malfunction: cháy không hết

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.sorbentLoss = false;
    this.coExcursion = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const coalTph = Math.max(0, ctx.getTag('BLR_COAL_FLOW_01'));
    const vFgNm3h = Math.max(0, ctx.getTag('EMI_FG_VOLUME_01')); // Nm³/h (từ EmissionsModel)
    const o2 = ctx.getTag('BLR_FLUE_O2_01'); // %
    const firing = coalTph > 5;

    // ── Thuỷ ngân ──
    const aciOn = firing && !this.sorbentLoss;
    const hgCapture = firing ? clamp(HG_CAPTURE_BASE + (aciOn ? HG_CAPTURE_ACI : 0), 0, 0.95) : 0;
    const hgTotalGh = coalTph * HG_COAL_GPT; // g/h
    const hgStackGh = hgTotalGh * (1 - hgCapture); // g/h thoát ống khói
    const hgConc = vFgNm3h > 1 ? (hgStackGh * 1e6) / vFgNm3h : 0; // µg/Nm³ (g→µg = ×1e6)

    // ── CO ──
    // CO nền tăng theo mũ khi O₂ tụt dưới danh định (thiếu gió → cháy không hết). Sự cố → CO cao cố định.
    const o2Eff = firing ? Math.max(0, o2) : O2_REF;
    const coBase = firing ? CO_BASE_MG * Math.exp(CO_K * (O2_REF - o2Eff)) : 0;
    const coStack = this.coExcursion && firing ? Math.max(coBase, CO_EXCURSION_MG) : coBase;
    // Hiệu chỉnh về 6% O₂: C_corr = C × (21−6)/(21−O₂).
    const coCorrected = firing ? coStack * ((21 - O2_CORR) / Math.max(1, 21 - o2Eff)) : 0;
    // Hiệu suất cháy: CO cao → cháy kém (mất nhiệt do CO chưa cháy).
    const combustionEff = firing ? clamp(100 - coStack * 0.004, 90, 100) : 0;

    return {
      outputs: [
        { tagId: 'CEMS_HG_STACK_01', value: hgConc, quality: 'Good' },
        { tagId: 'CEMS_HG_CAPTURE_01', value: hgCapture * 100, quality: 'Good' },
        { tagId: 'CEMS_HG_RATE_01', value: hgStackGh, quality: 'Good' },
        { tagId: 'CEMS_HG_ACI_01', value: aciOn ? ACI_RATE_KGH : 0, quality: 'Good' },
        { tagId: 'CEMS_CO_STACK_01', value: coStack, quality: 'Good' },
        { tagId: 'CEMS_CO_CORRECTED_01', value: coCorrected, quality: 'Good' },
        { tagId: 'CEMS_COMBUSTION_EFF_01', value: combustionEff, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { sorbentLoss: this.sorbentLoss ? 1 : 0, coExcursion: this.coExcursion ? 1 : 0 } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.sorbentLoss = (snapshot.state.sorbentLoss ?? 0) > 0.5;
    this.coExcursion = (snapshot.state.coExcursion ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'hg-sorbent-loss') this.sorbentLoss = true; // mất ACI → Hg thoát tăng
    if (m.id === 'co-excursion') this.coExcursion = true; // cháy không hết → CO cao
  }
  clearMalfunction(id: string): void {
    if (id === 'hg-sorbent-loss') this.sorbentLoss = false;
    if (id === 'co-excursion') this.coExcursion = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

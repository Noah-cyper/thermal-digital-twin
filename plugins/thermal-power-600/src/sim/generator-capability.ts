// Plugin thermal-power-600 — GeneratorCapabilityModel (ISimModel, doc 10 §7 — biểu đồ khả năng P-Q máy phát).
// CHỈ import @idtp/sdk. CHIỀU SÂU điện: vị trí điểm vận hành trên BIỂU ĐỒ KHẢ NĂNG (capability curve) — giới
// hạn (1) dòng STATOR (vòng tròn MVA định mức), (2) NHIỆT KÍCH TỪ/rotor phía quá kích (đường cong trên), (3)
// mất ổn định/nhiệt vùng đầu phía thiếu kích (đường dưới). Đọc GEN_MW_01 + GEN_MVAR_01 → % tải MVA · biên tới
// giới hạn gần nhất · giới hạn nào đang ràng buộc. MẤT LÀM MÁT stator/rotor DERATE giới hạn (thu hẹp biên).
//
// ADDITIVE — sinh tag GCAP_* ĐỘC LẬP; KHÔNG đổi GEN_MW/GEN_MVAR lõi (0 hồi quy). Tất định. Có TRẠNG THÁI (cờ
// derate làm mát) → snapshot/restore. Malfunction: 'stator-cooling-loss' (giảm giới hạn MVA stator) ·
// 'field-cooling-loss' (giảm giới hạn phía quá kích) — điểm vận hành TIẾN gần giới hạn dù P/Q lõi không đổi.
//
// Neo Design Basis (Phụ lục A §3.3): máy phát 667 MVA · cosφ 0,9 (⇒ MW định mức 600, MVAr quá kích ~291). Giới
// hạn phía thiếu kích, hệ số derate làm mát = [GIẢ ĐỊNH].
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const MVA_RATED = 667; // MVA — công suất biểu kiến định mức (giới hạn dòng stator)
const P_RATED_MW = 600; // MW — công suất tác dụng định mức
const Q_UNDER_LIMIT_MVAR = -200; // MVAr — giới hạn phía thiếu kích (leading, ổn định/nhiệt vùng đầu)
const STATOR_DERATE = 0.75; // — hệ số MVA khi mất làm mát stator (667 → ~500, điểm vận hành vượt giới hạn)
const FIELD_DERATE = 0.60; // — hệ số biên quá kích khi mất làm mát rotor (thu hẹp tới sát điểm vận hành)
const LOADING_HEALTHY_MAX = 95; // % — tải MVA lành mạnh
const Q_MARGIN_HEALTHY_MIN = 30; // MVAr — biên tới giới hạn lành mạnh

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class GeneratorCapabilityModel implements ISimModel {
  readonly id = 'thermal-generator-capability';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'GCAP_MVA_01', // MVA — công suất biểu kiến hiện tại
    'GCAP_MVA_RATED_01', // MVA — giới hạn stator hiệu dụng (có derate)
    'GCAP_MVA_LOADING_01', // % — tải MVA so giới hạn stator
    'GCAP_Q_OVER_LIMIT_01', // MVAr — trần MVAr phía quá kích tại P hiện tại
    'GCAP_Q_UNDER_LIMIT_01', // MVAr — sàn MVAr phía thiếu kích
    'GCAP_Q_MARGIN_01', // MVAr — biên tới giới hạn Q gần nhất
    'GCAP_LIMIT_BINDING_01', // 0 none · 1 stator · 2 field(over) · 3 under-exc
    'GCAP_HEALTHY_01', // 0/1 — trong biểu đồ khả năng, còn biên
  ];

  private statorDerate = false;
  private fieldDerate = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.statorDerate = false;
    this.fieldDerate = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const p = Math.max(0, ctx.getTag('GEN_MW_01'));
    const q = ctx.getTag('GEN_MVAR_01');
    const mva = Math.sqrt(p * p + q * q);

    const mvaLimit = MVA_RATED * (this.statorDerate ? STATOR_DERATE : 1);
    const mvaLoading = clamp((mva / mvaLimit) * 100, 0, 200);

    // Trần MVAr phía quá kích tại P: vòng tròn stator √(MVAlimit² − P²), thu hẹp khi mất làm mát rotor.
    const qOverStator = Math.sqrt(Math.max(0, mvaLimit * mvaLimit - p * p));
    const qOverLimit = qOverStator * (this.fieldDerate ? FIELD_DERATE : 1);
    const qUnderLimit = Q_UNDER_LIMIT_MVAR;

    // Biên tới giới hạn Q gần nhất (quá kích trần, thiếu kích sàn).
    const marginOver = qOverLimit - q;
    const marginUnder = q - qUnderLimit;
    const qMargin = Math.min(marginOver, marginUnder);

    // Giới hạn đang ràng buộc.
    let binding = 0;
    if (mvaLoading >= 100) binding = 1; // stator
    else if (marginOver <= marginUnder && marginOver < Q_MARGIN_HEALTHY_MIN) binding = 2; // field/over-exc
    else if (marginUnder < Q_MARGIN_HEALTHY_MIN) binding = 3; // under-exc

    const healthy = mvaLoading <= LOADING_HEALTHY_MAX && qMargin >= Q_MARGIN_HEALTHY_MIN ? 1 : 0;

    return {
      outputs: [
        { tagId: 'GCAP_MVA_01', value: mva, quality: 'Good' },
        { tagId: 'GCAP_MVA_RATED_01', value: mvaLimit, quality: 'Good' },
        { tagId: 'GCAP_MVA_LOADING_01', value: mvaLoading, quality: 'Good' },
        { tagId: 'GCAP_Q_OVER_LIMIT_01', value: qOverLimit, quality: 'Good' },
        { tagId: 'GCAP_Q_UNDER_LIMIT_01', value: qUnderLimit, quality: 'Good' },
        { tagId: 'GCAP_Q_MARGIN_01', value: qMargin, quality: 'Good' },
        { tagId: 'GCAP_LIMIT_BINDING_01', value: binding, quality: 'Good' },
        { tagId: 'GCAP_HEALTHY_01', value: healthy, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { statorDerate: this.statorDerate ? 1 : 0, fieldDerate: this.fieldDerate ? 1 : 0 } };
  }
  restore(s: ISimSnapshot): void {
    this.statorDerate = (s.state.statorDerate ?? 0) > 0.5;
    this.fieldDerate = (s.state.fieldDerate ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'stator-cooling-loss') this.statorDerate = true;
    if (m.id === 'field-cooling-loss') this.fieldDerate = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'stator-cooling-loss') this.statorDerate = false;
    if (id === 'field-cooling-loss') this.fieldDerate = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

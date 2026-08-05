// Plugin thermal-power-600 — AnsiProtectionModel (ISimModel, doc 10 §7 — Bảo vệ máy phát ANSI/IEEE C37.102).
// CHỈ import @idtp/sdk. CHIỀU SÂU phía điện: mô phỏng các CHỨC NĂNG RƠLE BẢO VỆ máy phát theo mã ANSI —
//  87G  vi sai máy phát (chạm chập trong cuộn dây)
//  40   mất kích từ (loss-of-field, thiếu kích → mất đồng bộ)
//  46   dòng thứ tự nghịch (unbalanced/negative-sequence, I2²t)
//  81   tần số cao/thấp (over/under-frequency)
//  24   quá kích thích V/Hz (volts-per-hertz, bão hoà từ)
// Đọc đại lượng điện (GEN_MVAR · dòng kích từ AVR · điện áp cực · tần số trạm) → tính pickup/trip + biên.
//
// ADDITIVE — sinh tag ANSI_* độc lập; KHÔNG ghi tag process/ngắt máy cắt (rơle chỉ GIÁM SÁT + phát CỜ trip;
// nối cắt máy cắt thật = tầng C&E sâu hơn, để sau). Read-only tuyệt đối. Tất định. Vận hành bình thường:
// mọi phần tử KHÔNG pickup (biên an toàn). Không giữ trạng thái latch (pickup theo điều kiện hiện tại → OTS
// clear malfunction là phục hồi). Malfunction: 'gen-internal-fault' (87) · 'gen-loss-field' (40) ·
// 'gen-unbalance' (46). 81/24 theo tần số/điện áp thực.
//
// Neo Design Basis (Phụ lục A §3.3): máy phát 667 MVA · 20 kV · 50 Hz. Ngưỡng pickup/định thời = [GIẢ ĐỊNH]
// GĐ-109 — bảng chỉnh định rơle bảo vệ thật (relay setting sheet) thay khi có.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const DIFF_NORMAL_PCT = 0.5; // % — dòng vi sai nền (sai số CT)
const DIFF_FAULT_PCT = 45; // % — dòng vi sai khi chạm chập trong cuộn
const DIFF_PICKUP_PCT = 10; // % — ngưỡng 87G
const I2_NORMAL_PCT = 2; // % — dòng thứ tự nghịch nền (tải hơi lệch)
const I2_FAULT_PCT = 15; // % — khi mất cân bằng nặng
const I2_PICKUP_PCT = 8; // % — giới hạn liên tục (46, I2²t)
const FREQ_HI_HZ = 51; // Hz — 81O
const FREQ_LO_HZ = 49; // Hz — 81U
const VHZ_PICKUP_PCT = 110; // % — 24 (quá kích thích)
const FIELD_NOM_A = 3000; // A — dòng kích từ điểm vận hành
const LOF_MARGIN_PICKUP_PCT = 25; // % — biên mất kích từ dưới ngưỡng → 40 pickup

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class AnsiProtectionModel implements ISimModel {
  readonly id = 'thermal-ansi-protection';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'ANSI_87_DIFF_01', // % — dòng vi sai máy phát
    'ANSI_87_TRIP_01', // 0/1 — 87G trip
    'ANSI_40_MARGIN_01', // % — biên tới đặc tuyến mất kích từ (cao = an toàn)
    'ANSI_40_PICKUP_01', // 0/1 — 40 pickup
    'ANSI_46_I2_01', // % — dòng thứ tự nghịch I2/In
    'ANSI_46_PICKUP_01', // 0/1 — 46 pickup
    'ANSI_81_FREQ_01', // Hz — tần số
    'ANSI_81_PICKUP_01', // 0/1 — 81 pickup (cao hoặc thấp)
    'ANSI_24_VHZ_01', // % — V/Hz so định mức
    'ANSI_24_PICKUP_01', // 0/1 — 24 pickup
    'ANSI_PROT_HEALTHY_01', // 0/1 — mọi phần tử bình thường
    'ANSI_TRIP_ANY_01', // 0/1 — có bất kỳ lệnh trip bảo vệ
  ];

  private internalFault = false;
  private lossField = false;
  private unbalance = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.internalFault = false;
    this.lossField = false;
    this.unbalance = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const field = Math.max(0, ctx.getTag('ELEC_FIELD_CURRENT_01')); // A (từ AVR)
    const vPu = ctx.getTag('ELEC_TERM_VOLT_PU_01') || 1.0; // pu (từ AVR)
    const freqRaw = ctx.getTag('SY_FREQ_01'); // Hz (từ switchyard)
    const freq = freqRaw > 1 ? freqRaw : 50;

    // 87G vi sai: nền do sai số CT; chạm chập → vọt cao.
    const diff = this.internalFault ? DIFF_FAULT_PCT : DIFF_NORMAL_PCT;
    const trip87 = diff > DIFF_PICKUP_PCT;

    // 40 mất kích từ: biên suy từ dòng kích từ (cao = kích đủ, an toàn). Mất kích → biên sập → pickup.
    const margin40 = this.lossField ? 12 : clamp(30 + (field / FIELD_NOM_A) * 55, 0, 100);
    const pickup40 = margin40 < LOF_MARGIN_PICKUP_PCT;

    // 46 thứ tự nghịch: nền tải hơi lệch; mất cân bằng nặng → I2 cao.
    const i2 = this.unbalance ? I2_FAULT_PCT : I2_NORMAL_PCT;
    const pickup46 = i2 > I2_PICKUP_PCT;

    // 81 tần số: pickup nếu ra ngoài dải.
    const pickup81 = freq > FREQ_HI_HZ || freq < FREQ_LO_HZ;

    // 24 V/Hz (quá kích thích): (V_pu / (f/50)) × 100.
    const vhz = (vPu / (freq / 50)) * 100;
    const pickup24 = vhz > VHZ_PICKUP_PCT;

    const anyPickup = trip87 || pickup40 || pickup46 || pickup81 || pickup24;

    return {
      outputs: [
        { tagId: 'ANSI_87_DIFF_01', value: diff, quality: 'Good' },
        { tagId: 'ANSI_87_TRIP_01', value: trip87 ? 1 : 0, quality: 'Good' },
        { tagId: 'ANSI_40_MARGIN_01', value: margin40, quality: 'Good' },
        { tagId: 'ANSI_40_PICKUP_01', value: pickup40 ? 1 : 0, quality: 'Good' },
        { tagId: 'ANSI_46_I2_01', value: i2, quality: 'Good' },
        { tagId: 'ANSI_46_PICKUP_01', value: pickup46 ? 1 : 0, quality: 'Good' },
        { tagId: 'ANSI_81_FREQ_01', value: freq, quality: 'Good' },
        { tagId: 'ANSI_81_PICKUP_01', value: pickup81 ? 1 : 0, quality: 'Good' },
        { tagId: 'ANSI_24_VHZ_01', value: vhz, quality: 'Good' },
        { tagId: 'ANSI_24_PICKUP_01', value: pickup24 ? 1 : 0, quality: 'Good' },
        { tagId: 'ANSI_PROT_HEALTHY_01', value: anyPickup ? 0 : 1, quality: 'Good' },
        { tagId: 'ANSI_TRIP_ANY_01', value: anyPickup ? 1 : 0, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { internalFault: this.internalFault ? 1 : 0, lossField: this.lossField ? 1 : 0, unbalance: this.unbalance ? 1 : 0 } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.internalFault = (snapshot.state.internalFault ?? 0) > 0.5;
    this.lossField = (snapshot.state.lossField ?? 0) > 0.5;
    this.unbalance = (snapshot.state.unbalance ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'gen-internal-fault') this.internalFault = true; // 87G
    if (m.id === 'gen-loss-field') this.lossField = true; // 40
    if (m.id === 'gen-unbalance') this.unbalance = true; // 46
  }
  clearMalfunction(id: string): void {
    if (id === 'gen-internal-fault') this.internalFault = false;
    if (id === 'gen-loss-field') this.lossField = false;
    if (id === 'gen-unbalance') this.unbalance = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

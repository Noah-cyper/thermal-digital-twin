// Plugin thermal-power-600 — AgcSecondaryModel (ISimModel, doc 10 §7 — điều tần thứ cấp AGC / tie-line bias).
// CHỈ import @idtp/sdk. CHIỀU SÂU vật lý phía điều tần: PRIMARY (governor/PFR) CHẶN độ lệch tần số; SECONDARY
// (AGC) KHÔI PHỤC tần số về danh định + đưa công suất tie-line về lịch. AGC = tích phân chậm trên Area Control
// Error: ACE = ΔP_tie + B·Δf (tie-line bias). Đọc GOV_GRID_FREQ_01 (từ model governor) + GEN_MW_01 → mô hình
// dòng tie-line nội, tín hiệu điều tiết (regulation) đưa ACE → 0 trong vài phút. Nối tiếp governor (GĐ-118).
//
// ADDITIVE — sinh tag AGC_* ĐỘC LẬP; KHÔNG đổi GEN_MW_01 / GOV_* (0 hồi quy). Regulation là tín hiệu AGC SẼ
// ra lệnh (diagnostic), không ghi tải lõi. Tất định (không Math.random). Có TRẠNG THÁI (dòng tie + tích phân
// regulation) → snapshot/restore. Malfunction: 'agc-oos' (AGC ngưng → ACE không được khôi phục) ·
// 'tie-line-disturbance' (dòng tie lệch lịch → ACE ≠ 0 → AGC điều tiết về).
//
// Neo Design Basis (Phụ lục A §3.3): tổ 600 MW, lưới 50 Hz. Frequency bias B ≈ 240 MW/Hz (đáp ứng tự nhiên
// tổ ở droop 5%). Lịch tie-line, biên dao động, hằng thời gian khôi phục, hệ số tích phân AGC = [GIẢ ĐỊNH].
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const F_NOM_HZ = 50;
const FREQ_BIAS_MW_HZ = 240; // MW/Hz — frequency bias B (đáp ứng tự nhiên tổ)
const TIE_SCHED_MW = 200; // MW — công suất tie-line theo lịch (export)
const TIE_DISTURB_MW = 90; // MW — độ lệch dòng tie khi nhiễu
const TAU_TIE_S = 6; // s — hằng thời gian tiến hoá dòng tie
const KI_AGC = 0.03; // 1/s — hệ số tích phân AGC (khôi phục ~30 s)
const ACE_BAND_MW = 15; // MW — dải ACE chấp nhận (CPS ok)
const REG_MAX_MW = 120; // MW — biên tín hiệu điều tiết AGC (±20% MCR, còn margin trên nhiễu tie 90 MW)

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class AgcSecondaryModel implements ISimModel {
  readonly id = 'thermal-agc-secondary';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'AGC_ENABLED_01', // 0/1 — AGC trong vận hành
    'AGC_FREQ_BIAS_01', // MW/Hz — frequency bias B
    'AGC_TIE_SCHED_01', // MW — lịch tie-line
    'AGC_TIE_FLOW_01', // MW — dòng tie-line thực (mô hình)
    'AGC_ACE_01', // MW — Area Control Error hiện
    'AGC_REG_SIGNAL_01', // MW — tín hiệu điều tiết AGC (regulation)
    'AGC_SETPOINT_01', // MW — setpoint tải sau hiệu chỉnh AGC
    'AGC_CPS_OK_01', // 0/1 — ACE trong dải (Control Performance Standard)
    'AGC_HEALTHY_01', // 0/1 — AGC bình thường, khôi phục được
  ];

  private tieDev = 0; // MW — độ lệch dòng tie khỏi lịch
  private reg = 0; // MW — tích phân điều tiết
  private enabled = true;
  private disturb = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.tieDev = 0;
    this.reg = 0;
    this.enabled = true;
    this.disturb = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dt = ctx.dtMs / 1000;
    const mw = Math.max(0, ctx.getTag('GEN_MW_01'));
    const gridFreq = ctx.getTag('GOV_GRID_FREQ_01') || F_NOM_HZ;
    const freqDev = gridFreq - F_NOM_HZ;

    // Dòng tie-line tiến hoá tới đích (lịch + nhiễu).
    const tieTarget = this.disturb ? TIE_DISTURB_MW : 0;
    this.tieDev += (tieTarget - this.tieDev) * (dt / TAU_TIE_S);
    const tieFlow = TIE_SCHED_MW + this.tieDev;

    // ACE thô = ΔP_tie + B·Δf. ACE hiện = thô + điều tiết (regulation bù dần → ACE → 0).
    const aceRaw = this.tieDev + FREQ_BIAS_MW_HZ * freqDev;
    const ace = aceRaw + this.reg;

    // AGC tích phân: reg đuổi −ACE (đưa ACE hiện về 0). AGC ngưng → reg đóng băng.
    if (this.enabled) this.reg = clamp(this.reg - KI_AGC * ace * dt, -REG_MAX_MW, REG_MAX_MW);

    const setpoint = mw + this.reg;
    const cpsOk = Math.abs(ace) <= ACE_BAND_MW ? 1 : 0;
    const healthy = this.enabled && Math.abs(this.reg) < REG_MAX_MW ? 1 : 0;

    return {
      outputs: [
        { tagId: 'AGC_ENABLED_01', value: this.enabled ? 1 : 0, quality: 'Good' },
        { tagId: 'AGC_FREQ_BIAS_01', value: FREQ_BIAS_MW_HZ, quality: 'Good' },
        { tagId: 'AGC_TIE_SCHED_01', value: TIE_SCHED_MW, quality: 'Good' },
        { tagId: 'AGC_TIE_FLOW_01', value: tieFlow, quality: 'Good' },
        { tagId: 'AGC_ACE_01', value: ace, quality: 'Good' },
        { tagId: 'AGC_REG_SIGNAL_01', value: this.reg, quality: 'Good' },
        { tagId: 'AGC_SETPOINT_01', value: setpoint, quality: 'Good' },
        { tagId: 'AGC_CPS_OK_01', value: cpsOk, quality: 'Good' },
        { tagId: 'AGC_HEALTHY_01', value: healthy, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { tieDev: this.tieDev, reg: this.reg, enabled: this.enabled ? 1 : 0, disturb: this.disturb ? 1 : 0 } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.tieDev = snapshot.state.tieDev ?? 0;
    this.reg = snapshot.state.reg ?? 0;
    this.enabled = (snapshot.state.enabled ?? 1) > 0.5;
    this.disturb = (snapshot.state.disturb ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'agc-oos') this.enabled = false;
    if (m.id === 'tie-line-disturbance') this.disturb = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'agc-oos') this.enabled = true;
    if (id === 'tie-line-disturbance') this.disturb = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

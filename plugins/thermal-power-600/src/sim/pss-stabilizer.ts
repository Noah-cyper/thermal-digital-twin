// Plugin thermal-power-600 — PssStabilizerModel (ISimModel, doc 10 §7 — Power System Stabilizer, cạnh AVR).
// CHỈ import @idtp/sdk. CHIỀU SÂU vật lý phía điện: PSS bơm TÍN HIỆU PHỤ vào tổng của AVR (Vs) để DẬP
// dao động điện-cơ tần số thấp (local mode ~1 Hz) bằng cách điều biến kích từ TẠO MÔ-MEN DẬP cùng pha
// với sai lệch tốc độ rotor (Δω). Mô hình có DAO ĐỘNG NỘI (oscillator bậc 2 của local mode): khi có nhiễu
// lưới, biên độ dao động công suất phụ thuộc HỆ SỐ DẬP ζ — PSS bật → ζ cao (dập nhanh), PSS off/chỉnh sai →
// ζ thấp/âm (dao động dai/tăng). Đầu vào Δω qua washout + lead → Vs (giới hạn ±5 %).
//
// ADDITIVE — sinh tag PSS_* ĐỘC LẬP; KHÔNG ghi đè GEN_MW_01 / ELEC_* / TRB_* (0 hồi quy). Dao động nội chỉ là
// mô hình small-signal của PSS, KHÔNG tác động lõi. Tất định (không Math.random). Có TRẠNG THÁI (góc/tốc độ
// dao động + bộ lọc) → snapshot/restore. Ở điểm vận hành (không nhiễu) biên độ → 0, yên tĩnh.
// Malfunction: 'grid-oscillation' (lưới kích dao động local-mode duy trì) · 'pss-out-of-service' (PSS ngưng →
// ζ tụt, dao động dai) · 'pss-gain-high' (chỉnh gain quá cao → ζ âm → dao động TĂNG, minh hoạ rủi ro mis-tune).
//
// Neo Design Basis (Phụ lục A §3.3): máy phát 667 MVA · 20 kV; local electromechanical mode ~1 Hz. Tần số mode,
// ζ bật/tắt, gain PSS Ks, giới hạn Vs, hệ số Δω = [GIẢ ĐỊNH] GĐ-116.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const F_LOCAL_HZ = 1.05; // Hz — tần số local electromechanical mode
const OMEGA = 2 * Math.PI * F_LOCAL_HZ; // rad/s
const OMEGA2 = OMEGA * OMEGA;
const ZETA_ON = 0.15; // — hệ số dập khi PSS bật (dập tốt)
const ZETA_OFF = 0.03; // — hệ số dập tự nhiên khi PSS ngưng (dập kém)
const ZETA_GAINHI = -0.02; // — ζ âm khi gain PSS quá cao (mis-tune → dao động tăng)
const ZETA_MIN_OK = 0.05; // — ngưỡng ζ đủ dập (dưới ngưỡng = không lành mạnh)
const FORCING_MW = 70; // MW/s² — biên lực kích dao động của nhiễu lưới (cộng hưởng tại mode freq)
const AMP_CAP_MW = 80; // MW — chặn biên độ (tránh runaway khi ζ âm)
const KS_PU = 9.0; // pu Vs / pu Δω — gain PSS
const T_LEAD_S = 0.15; // s — bù pha lead (đưa Vs cùng pha Δω)
const T_WASH_S = 10; // s — washout (bỏ thành phần DC của Δω)
const VS_MAX_PU = 0.05; // pu — giới hạn tín hiệu phụ PSS (±5 % kích từ)
const K_DW = 6e-5; // pu/(MW/s) — quy đổi tốc độ dao động → sai lệch tốc độ rotor Δω

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class PssStabilizerModel implements ISimModel {
  readonly id = 'thermal-pss-stabilizer';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'PSS_ENABLED_01', // 0/1 — PSS đang hoạt động
    'PSS_MODE_FREQ_01', // Hz — tần số local mode đang dập
    'PSS_SPEED_DEV_01', // pu — sai lệch tốc độ rotor Δω (đầu vào PSS)
    'PSS_OUTPUT_01', // pu — tín hiệu phụ Vs bơm vào AVR
    'PSS_DAMPING_RATIO_01', // — hệ số dập hiệu dụng ζ
    'PSS_OSC_AMPLITUDE_01', // MW — biên độ dao động công suất local mode
    'PSS_OSC_ACTIVE_01', // 0/1 — đang có nhiễu kích dao động
    'PSS_HEALTHY_01', // 0/1 — dập đủ margin (ζ ≥ ngưỡng)
  ];

  private oscAngle = 0; // MW — lệch góc/công suất dao động
  private oscVel = 0; // MW/s — tốc độ dao động
  private lpDw = 0; // pu — low-pass của Δω (cho washout)
  private washPrev = 0; // pu — washout bước trước (cho lead)
  private tSec = 0; // s — đồng hồ nội (pha lực kích)
  private enabled = true;
  private gainHigh = false;
  private oscForcing = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.oscAngle = 0;
    this.oscVel = 0;
    this.lpDw = 0;
    this.washPrev = 0;
    this.tSec = 0;
    this.enabled = true;
    this.gainHigh = false;
    this.oscForcing = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dt = ctx.dtMs / 1000;
    const online = ctx.getTag('GEN_MW_01') > 5; // chỉ dập khi máy phát hoà lưới

    // ζ hiệu dụng theo trạng thái PSS.
    const zeta = !this.enabled ? ZETA_OFF : this.gainHigh ? ZETA_GAINHI : ZETA_ON;

    // Dao động local-mode bậc 2: xddot = F − 2ζω·xdot − ω²·x (lực kích cộng hưởng khi có nhiễu lưới).
    const forcing = this.oscForcing && online ? FORCING_MW * Math.sin(OMEGA * this.tSec) : 0;
    const xddot = forcing - 2 * zeta * OMEGA * this.oscVel - OMEGA2 * this.oscAngle;
    this.oscVel += xddot * dt;
    this.oscAngle = clamp(this.oscAngle + this.oscVel * dt, -AMP_CAP_MW, AMP_CAP_MW);
    this.tSec += dt;

    // Biên độ (envelope) của oscillator small-signal.
    const amplitude = Math.sqrt(this.oscAngle * this.oscAngle + (this.oscVel / OMEGA) * (this.oscVel / OMEGA));

    // Sai lệch tốc độ rotor Δω từ tốc độ dao động → washout (bỏ DC) → lead (bù pha) → gain Ks → giới hạn Vs.
    const dOmega = -this.oscVel * K_DW;
    this.lpDw += (dOmega - this.lpDw) * (dt / T_WASH_S);
    const washOut = dOmega - this.lpDw;
    const dWash = (washOut - this.washPrev) / dt;
    this.washPrev = washOut;
    const vsRaw = this.enabled ? KS_PU * (washOut + T_LEAD_S * dWash) : 0;
    const vs = clamp(vsRaw, -VS_MAX_PU, VS_MAX_PU);

    const healthy = this.enabled && zeta >= ZETA_MIN_OK ? 1 : 0;

    return {
      outputs: [
        { tagId: 'PSS_ENABLED_01', value: this.enabled ? 1 : 0, quality: 'Good' },
        { tagId: 'PSS_MODE_FREQ_01', value: F_LOCAL_HZ, quality: 'Good' },
        { tagId: 'PSS_SPEED_DEV_01', value: dOmega, quality: 'Good' },
        { tagId: 'PSS_OUTPUT_01', value: vs, quality: 'Good' },
        { tagId: 'PSS_DAMPING_RATIO_01', value: zeta, quality: 'Good' },
        { tagId: 'PSS_OSC_AMPLITUDE_01', value: amplitude, quality: 'Good' },
        { tagId: 'PSS_OSC_ACTIVE_01', value: this.oscForcing ? 1 : 0, quality: 'Good' },
        { tagId: 'PSS_HEALTHY_01', value: healthy, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return {
      state: {
        oscAngle: this.oscAngle,
        oscVel: this.oscVel,
        lpDw: this.lpDw,
        washPrev: this.washPrev,
        tSec: this.tSec,
        enabled: this.enabled ? 1 : 0,
        gainHigh: this.gainHigh ? 1 : 0,
        oscForcing: this.oscForcing ? 1 : 0,
      },
    };
  }
  restore(snapshot: ISimSnapshot): void {
    this.oscAngle = snapshot.state.oscAngle ?? 0;
    this.oscVel = snapshot.state.oscVel ?? 0;
    this.lpDw = snapshot.state.lpDw ?? 0;
    this.washPrev = snapshot.state.washPrev ?? 0;
    this.tSec = snapshot.state.tSec ?? 0;
    this.enabled = (snapshot.state.enabled ?? 1) > 0.5;
    this.gainHigh = (snapshot.state.gainHigh ?? 0) > 0.5;
    this.oscForcing = (snapshot.state.oscForcing ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'grid-oscillation') this.oscForcing = true;
    if (m.id === 'pss-out-of-service') this.enabled = false;
    if (m.id === 'pss-gain-high') this.gainHigh = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'grid-oscillation') this.oscForcing = false;
    if (id === 'pss-out-of-service') this.enabled = true;
    if (id === 'pss-gain-high') this.gainHigh = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

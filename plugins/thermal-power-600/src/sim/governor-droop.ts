// Plugin thermal-power-600 — GovernorDroopModel (ISimModel, doc 10 §7 — điều tốc turbine & đáp ứng tần số sơ cấp).
// CHỈ import @idtp/sdk. CHIỀU SÂU vật lý phía điều tốc: đặc tuyến DROOP 5 % + DEADBAND + PRIMARY FREQUENCY
// RESPONSE (PFR). Khi tần số lưới lệch khỏi deadband, điều tốc mở/đóng van theo droop → đơn vị GÓP công suất
// đỡ/giảm tần số. Mô hình có TRẠNG THÁI tần số lưới nội (small-signal sự kiện lưới): 'grid-underfrequency'
// kéo tần số xuống 49,8 Hz → điều tốc tăng tải; 'grid-overfrequency' → 50,2 Hz → giảm tải. Cặp đôi tự nhiên
// với AVR/PSS (phía điện): AVR/PSS lo ĐIỆN ÁP & DAO ĐỘNG, điều tốc lo TẦN SỐ & TẢI.
//
// ADDITIVE — sinh tag GOV_* ĐỘC LẬP; KHÔNG đổi GEN_MW_01 / GEN_FREQ_01 / TRB_* (0 hồi quy). PFR là tín hiệu
// điều tốc SẼ ra lệnh (diagnostic), không ghi tải lõi. Tất định (không Math.random). Có TRẠNG THÁI (tần số
// lưới nội) → snapshot/restore. Malfunction: 'grid-underfrequency' · 'grid-overfrequency' · 'governor-oos'
// (điều tốc ngưng → mất PFR) · 'droop-mistuned' (droop 2 % → phản ứng quá mức).
//
// Neo Design Basis (Phụ lục A §3.3): tổ 600 MW, lưới 50 Hz, droop 5 % (chuẩn), deadband ±30 mHz (lưới VN).
// Đích tần số sự kiện, khả năng PFR, hằng thời gian sự kiện lưới = [GIẢ ĐỊNH].
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const F_NOM_HZ = 50;
const DROOP_NORMAL = 0.05; // 5 % droop chuẩn
const DROOP_MISTUNE = 0.02; // 2 % — chỉnh sai (quá nhạy)
const DEADBAND_HZ = 0.03; // ±30 mHz — vùng chết chống hunting
const P_RATED_MW = 600; // MW — MCR để quy đổi pu
const PFR_MAX_MW = 60; // MW — khả năng đáp ứng tần số sơ cấp (±10 % MCR)
const TAU_GRID_S = 8; // s — hằng thời gian tiến hoá sự kiện tần số lưới
const UF_TARGET_HZ = 49.8; // Hz — đích khi under-frequency
const OF_TARGET_HZ = 50.2; // Hz — đích khi over-frequency

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class GovernorDroopModel implements ISimModel {
  readonly id = 'thermal-governor-droop';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'GOV_ENABLED_01', // 0/1 — điều tốc trong vận hành
    'GOV_DROOP_PCT_01', // % — hệ số droop hiệu dụng
    'GOV_GRID_FREQ_01', // Hz — tần số lưới (mô hình)
    'GOV_FREQ_DEV_MHZ_01', // mHz — lệch tần số so 50 Hz
    'GOV_DEADBAND_ACTIVE_01', // 0/1 — trong deadband (không đáp ứng)
    'GOV_VALVE_POS_01', // % — vị trí van điều tốc (nền + PFR)
    'GOV_PFR_MW_01', // MW — góp công suất đáp ứng tần số sơ cấp (+ = tăng)
    'GOV_LOAD_LIMIT_01', // % — giới hạn tải điều tốc
    'GOV_HEALTHY_01', // 0/1 — điều tốc bình thường, còn margin đáp ứng
  ];

  private gridFreq = F_NOM_HZ;
  private enabled = true;
  private mistuned = false;
  private underFreq = false;
  private overFreq = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.gridFreq = F_NOM_HZ;
    this.enabled = true;
    this.mistuned = false;
    this.underFreq = false;
    this.overFreq = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dt = ctx.dtMs / 1000;
    const mw = Math.max(0, ctx.getTag('GEN_MW_01')); // MW hiện (chỉ đọc)

    // Tần số lưới (mô hình) tiến hoá tới đích theo sự kiện; bình thường bám tần số đơn vị (~50 Hz).
    const unitFreq = ctx.getTag('GEN_FREQ_01') || F_NOM_HZ;
    const target = this.underFreq ? UF_TARGET_HZ : this.overFreq ? OF_TARGET_HZ : unitFreq;
    this.gridFreq += (target - this.gridFreq) * (dt / TAU_GRID_S);

    const droop = this.mistuned ? DROOP_MISTUNE : DROOP_NORMAL;
    const devHz = this.gridFreq - F_NOM_HZ;
    const inDeadband = Math.abs(devHz) <= DEADBAND_HZ;

    // Ngoài deadband: ΔP_pu = −(Δf/f_n)/R; điều tốc mở van tăng tải khi tần số tụt (Δf âm → ΔP dương).
    const effDev = inDeadband ? 0 : devHz - Math.sign(devHz) * DEADBAND_HZ; // trừ deadband
    const pfrMwRaw = this.enabled ? -(effDev / F_NOM_HZ) / droop * P_RATED_MW : 0;
    const pfrMw = clamp(pfrMwRaw, -PFR_MAX_MW, PFR_MAX_MW);

    const baseValvePct = clamp((mw / P_RATED_MW) * 100, 0, 100);
    const valvePos = clamp(baseValvePct + (pfrMw / P_RATED_MW) * 100, 0, 100);
    const loadLimit = 100; // % MCR — giới hạn tải điều tốc

    // Lành mạnh: điều tốc bật, còn margin PFR (chưa bão hoà), van chưa chạm trần.
    const healthy = this.enabled && Math.abs(pfrMwRaw) < PFR_MAX_MW && valvePos < 99.5 ? 1 : 0;

    return {
      outputs: [
        { tagId: 'GOV_ENABLED_01', value: this.enabled ? 1 : 0, quality: 'Good' },
        { tagId: 'GOV_DROOP_PCT_01', value: droop * 100, quality: 'Good' },
        { tagId: 'GOV_GRID_FREQ_01', value: this.gridFreq, quality: 'Good' },
        { tagId: 'GOV_FREQ_DEV_MHZ_01', value: devHz * 1000, quality: 'Good' },
        { tagId: 'GOV_DEADBAND_ACTIVE_01', value: inDeadband ? 1 : 0, quality: 'Good' },
        { tagId: 'GOV_VALVE_POS_01', value: valvePos, quality: 'Good' },
        { tagId: 'GOV_PFR_MW_01', value: pfrMw, quality: 'Good' },
        { tagId: 'GOV_LOAD_LIMIT_01', value: loadLimit, quality: 'Good' },
        { tagId: 'GOV_HEALTHY_01', value: healthy, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return {
      state: {
        gridFreq: this.gridFreq,
        enabled: this.enabled ? 1 : 0,
        mistuned: this.mistuned ? 1 : 0,
        underFreq: this.underFreq ? 1 : 0,
        overFreq: this.overFreq ? 1 : 0,
      },
    };
  }
  restore(snapshot: ISimSnapshot): void {
    this.gridFreq = snapshot.state.gridFreq ?? F_NOM_HZ;
    this.enabled = (snapshot.state.enabled ?? 1) > 0.5;
    this.mistuned = (snapshot.state.mistuned ?? 0) > 0.5;
    this.underFreq = (snapshot.state.underFreq ?? 0) > 0.5;
    this.overFreq = (snapshot.state.overFreq ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'grid-underfrequency') { this.underFreq = true; this.overFreq = false; }
    if (m.id === 'grid-overfrequency') { this.overFreq = true; this.underFreq = false; }
    if (m.id === 'governor-oos') this.enabled = false;
    if (m.id === 'droop-mistuned') this.mistuned = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'grid-underfrequency') this.underFreq = false;
    if (id === 'grid-overfrequency') this.overFreq = false;
    if (id === 'governor-oos') this.enabled = true;
    if (id === 'droop-mistuned') this.mistuned = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

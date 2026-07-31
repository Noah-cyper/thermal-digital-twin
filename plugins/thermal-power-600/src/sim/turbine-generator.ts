// Plugin thermal-power-600 — TurbineGeneratorModel (ISimModel, doc 10 §6/§7). CHỈ import @idtp/sdk.
// CHIỀU SÂU vật lý bổ sung (v1.12), chạy CẠNH BoilerIslandModel: đọc hơi/áp/chân không/công suất →
// sinh THÊM tag turbine/generator (Stodola flow, tốc độ, tần số, công suất phản kháng, nhiệt stator).
// ADDITIVE — KHÔNG đổi GEN_MW_01 của boiler (0 hồi quy). Tất định (không Math.random). Ngưỡng ngoài
// Design Basis = [GIẢ ĐỊNH] (GĐ-59); tốc độ 3000 rpm / 50 Hz & chân không 5,4 kPa neo Design Basis.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

/* ── Design Basis ── */
const RATED_RPM = 3000; // 50 Hz đồng bộ
const MW_GROSS = 600;
const BMCR_STEAM_TPH = 2008;
const VACUUM_NOM_KPA = 5.4;
const P_MSTM_NOM_MPA = 17.5;
const NOM_STEAM_TPH = 1500; // hơi tại điểm vận hành ~448 MW

/* ── [GIẢ ĐỊNH] hiệu chỉnh (GĐ-59) ── */
const MW_PER_TPH = MW_GROSS / BMCR_STEAM_TPH; // ~0,2988
const K_STODOLA = NOM_STEAM_TPH / P_MSTM_NOM_MPA; // ~85,7 → Stodola flow ≈ hơi danh định tại áp nom
const K_IMB = 0.5; // rpm lệch / MW mất cân bằng cơ-điện
const TAU_SWING = 5; // s — quán tính swing tổ máy
const COAST_RPM = 200; // rpm vùng turning-gear khi trip (MSV đóng → không hơi vào turbine)
const TAU_COAST = 30; // s — quán tính coast-down khi trip (rotor lớn, quán tính cao) [GIẢ ĐỊNH]
const Q_FACTOR = 0.62; // MVAr/MW ở hệ số công suất 0,85 (tan(acos 0,85))
const STATOR_AMB = 45; // °C nền cuộn stator
const STATOR_RISE = 55; // °C tăng ở đầy tải (I²R)
const TAU_STATOR = 60; // s — quán tính nhiệt stator

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class TurbineGeneratorModel implements ISimModel {
  readonly id = 'thermal-turbine-generator';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'TRB_STODOLA_FLOW', // t/h — lưu lượng hơi qua turbine theo ellipse Stodola
    'TRB_SPEED_01', // rpm
    'GEN_FREQ_01', // Hz
    'GEN_MVAR_01', // MVAr — công suất phản kháng
    'GEN_STATOR_TEMP_01', // °C — nhiệt cuộn stator
  ];

  private speed = RATED_RPM;
  private statorTemp = 80;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.speed = RATED_RPM;
    this.statorTemp = 80;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dt = ctx.dtMs / 1000;
    const pin = Math.max(0, ctx.getTag('BLR_MSTM_SH_PRESS_01')); // MPa
    const poutKpa = Math.max(0, ctx.getTag('TRB_COND_VACUUM_01')); // kPa(a)
    const pout = poutKpa / 1000; // MPa
    const steam = Math.max(0, ctx.getTag('BLR_STEAM_FLOW_01')); // t/h
    const mw = Math.max(0, ctx.getTag('GEN_MW_01')); // MW
    // Turbine trip (C&E): MSV đóng → KHÔNG hơi vào turbine → Stodola 0, mất công cơ → rotor COAST-DOWN.
    const tripped = ctx.getTag('TRB_TRIP') > 0 || ctx.getTag('TRB_MSV_CLOSE') > 0;

    // Ellipse Stodola: lưu lượng ∝ √(p_in² − p_out²); trip → van stop đóng → 0.
    const stodola = tripped ? 0 : K_STODOLA * Math.sqrt(Math.max(0, pin * pin - pout * pout));

    // Swing tổ máy: cân bằng cơ (hơi) − điện (tải) → lệch tốc độ quanh 3000 rpm (khoá lưới). Trip → mất
    // công cơ + tách lưới → coast-down về vùng turning-gear (quán tính rotor lớn).
    const vacFactor = clamp(1 - (poutKpa - VACUUM_NOM_KPA) / 40, 0.5, 1);
    const pmech = tripped ? 0 : steam * MW_PER_TPH * vacFactor; // MW cơ
    const target = tripped ? COAST_RPM : RATED_RPM + K_IMB * (pmech - mw);
    this.speed += (target - this.speed) * (dt / (tripped ? TAU_COAST : TAU_SWING));
    const freq = this.speed / 60;

    const mvar = tripped ? 0 : mw * Q_FACTOR; // tách lưới → không phát công suất phản kháng
    const statorTarget = STATOR_AMB + STATOR_RISE * (mw / MW_GROSS);
    this.statorTemp += (statorTarget - this.statorTemp) * (dt / TAU_STATOR);

    return {
      outputs: [
        { tagId: 'TRB_STODOLA_FLOW', value: stodola, quality: 'Good' },
        { tagId: 'TRB_SPEED_01', value: this.speed, quality: 'Good' },
        { tagId: 'GEN_FREQ_01', value: freq, quality: 'Good' },
        { tagId: 'GEN_MVAR_01', value: mvar, quality: 'Good' },
        { tagId: 'GEN_STATOR_TEMP_01', value: this.statorTemp, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { speed: this.speed, statorTemp: this.statorTemp } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.speed = snapshot.state.speed ?? RATED_RPM;
    this.statorTemp = snapshot.state.statorTemp ?? 80;
  }
  injectMalfunction(_m: IMalfunction): void {
    // model không có malfunction riêng ở v1.12
  }
  clearMalfunction(_id: string): void {
    // không giữ trạng thái malfunction
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

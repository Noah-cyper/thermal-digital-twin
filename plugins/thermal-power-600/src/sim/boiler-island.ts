// Plugin thermal-power-600 — BoilerIslandModel (ISimModel, doc 10). CHỈ import @idtp/sdk (luật L-P1).
//
// Mở rộng từ DrumModel (Pha A) thành mô hình Boiler Island đầy đủ (Pha B):
//   coal → combustion (η_comb theo O₂/tải) → heat release → steam generation (τ/θ) →
//   drum (cân bằng khối lượng + swell/shrink theo −dP/dt) → main steam pressure (tích phân
//   gen−draw) → SH temp (spray) → O₂ (air/fuel) → furnace draft (FD−ID).
//
// Vật lý theo doc 10 §2-8 + Design Basis (Phụ lục A §3). Solver dt = 100 ms, tất định
// (KHÔNG Math.random — nhiễu đo dùng LCG có seed, trạng thái vào snapshot để replay tái lập).
import type {
  ISimModel,
  ISimModelContext,
  ISimStepResult,
  ISimSnapshot,
  IMalfunction,
  TagId,
} from '@idtp/sdk';

/** Điểm vận hành khởi tạo (warm-start) — tránh transient khởi động nguội. init(config) nhận qua
 *  { warmStart: {...} }; thiếu trường nào → mặc định nguội. */
interface WarmStart {
  coalFlow: number;
  steamGen: number;
  pressure: number;
  o2: number;
  shTemp: number;
}

/* ── Design Basis (Phụ lục A §3) — KHÔNG phải giả định ─────────────────── */
const LHV_KJ_PER_KG = 21_500; // than bituminous
const BMCR_STEAM_TPH = 2008; // lưu lượng hơi BMCR
const MW_GROSS = 600; // công suất gộp
const MILL_TPH = 60; // 6 × 60 t/h (5 chạy + 1 dự phòng)
const MILLS_RUNNING = 5;
const O2_NOM_PCT = 3.2; // O₂ sau economizer
const DRAFT_NOM_PA = -50; // áp buồng lửa
const P_MSTM_NOM_MPA = 17.5; // áp hơi chính SH out (điểm vận hành danh định)

/* ── [GIẢ ĐỊNH] hiệu chỉnh — doc 25 GĐ-32/33 (tuning trên sim thực) ─────── */
const COAL_MAX_TPH = MILL_TPH * MILLS_RUNNING; // 300 t/h công suất nghiền tối đa
const FW_MAX_TPH = 2100; // công suất feedwater (~BMCR + dự trữ)
const AIR_MAX_TPH = 4000; // gió cấp tối đa (FD 100%)
const DH_EVAP_KJKG = 2758; // enthalpy tăng hơi hiệu dụng: hiệu chỉnh coal ~280 → steam 2008 t/h
const ETA_COMB_MAX = 0.94; // hiệu suất cháy đỉnh (tại O₂ 3,2%, tải cao)
const K_O2_PENALTY = 0.01; // phạt hiệu suất khi O₂ lệch 3,2%
const AF_STOICH = 10.0; // kg gió / kg than (xấp xỉ hoá học)
const MW_PER_TPH = MW_GROSS / BMCR_STEAM_TPH; // ~0,2988 MW/(t/h) — turbine đơn giản hoá
const K_AREA = 30; // mm mức / (t nước tích luỹ trong bao hơi)
const K_PRESS = 2.0e-5; // MPa / (t/h · s) — điện dung hơi (gen−draw → dP/dt)
const K_SWELL_P = 8000; // mm / (MPa/s) — swell/shrink theo −dP_drum/dt (doc 10 §3)
const TAU_COAL_ACT = 8; // s — quán tính feeder/mill

// τ (hằng số thời gian) / θ (dead time) — doc 10 §4, đơn vị giây
const TAU_STEAM = 40;
const TH_STEAM = 20; // coal → steam production
const TAU_O2 = 20;
const TH_O2 = 8;
const TAU_SH = 45;
const TH_SH = 15; // SH steam temp (spray)
const TAU_FURN = 3;
const TH_FURN = 1; // furnace draft

// Đường cong nhiệt độ SH (°C) — T = T_base + span·tải − K_spray·spray
const T_FIRE_BASE = 505;
const T_FIRE_SPAN = 80;
const K_SPRAY = 95;
const K_DRAFT = 5; // Pa / % chênh (FD damper − ID vane)

// Biên nhiễu đo tuyệt đối (~0,1–0,3% giá trị danh định) — doc 10 §8
const N_LEVEL = 0.4; // mm
const N_PRESS = 0.02; // MPa
const N_TEMP = 0.5; // °C
const N_O2 = 0.03; // %
const N_FLOW = 2; // t/h
const N_COAL = 1; // t/h
const N_FURN = 3; // Pa
const N_MW = 0.5; // MW

const SIM_SEED = 0x9e3779b1; // seed cố định (golden ratio) → replay/re-sim tái lập

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function readWarmStart(config: unknown): WarmStart {
  const def: WarmStart = { coalFlow: 0, steamGen: 0, pressure: P_MSTM_NOM_MPA, o2: O2_NOM_PCT, shTemp: T_FIRE_BASE };
  if (config !== null && typeof config === 'object' && 'warmStart' in config) {
    const w = (config as { warmStart?: Partial<WarmStart> }).warmStart;
    if (w) return { ...def, ...w };
  }
  return def;
}

/** LCG 32-bit tất định (thay cho Math.random). Trạng thái serialize vào snapshot. */
class Lcg {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (Math.imul(this.s, 1_664_525) + 1_013_904_223) >>> 0;
    return this.s / 0x1_0000_0000;
  }
  /** nhiễu đối xứng ±amp */
  sym(amp: number): number {
    return (this.next() - 0.5) * 2 * amp;
  }
  get state(): number {
    return this.s;
  }
  set state(v: number) {
    this.s = v >>> 0;
  }
}

/** Quán tính bậc 1 + dead time (doc 10 §4: τ·dy/dt + y = K·u(t−θ)).
 *  Ring buffer trễ + trạng thái y đều vào snapshot để restore tái lập chính xác. */
class Foptd {
  private y = 0;
  private head = 0;
  private readonly ring: number[];
  constructor(
    private readonly tauSec: number,
    deadSec: number,
    dtSec: number,
  ) {
    const n = Math.max(1, Math.round(deadSec / dtSec));
    this.ring = new Array<number>(n).fill(0);
  }
  reset(y0: number): void {
    this.y = y0;
    this.head = 0;
    for (let i = 0; i < this.ring.length; i++) this.ring[i] = y0;
  }
  step(u: number, dtSec: number): number {
    const delayed = this.ring[this.head] ?? u;
    this.ring[this.head] = u;
    this.head = (this.head + 1) % this.ring.length;
    this.y += (dtSec / this.tauSec) * (delayed - this.y);
    return this.y;
  }
  value(): number {
    return this.y;
  }
  dump(out: Record<string, number>, k: string): void {
    out[`${k}.y`] = this.y;
    out[`${k}.head`] = this.head;
    for (let i = 0; i < this.ring.length; i++) out[`${k}.${i}`] = this.ring[i] ?? 0;
  }
  load(s: Readonly<Record<string, number>>, k: string): void {
    this.y = s[`${k}.y`] ?? this.y;
    this.head = s[`${k}.head`] ?? 0;
    for (let i = 0; i < this.ring.length; i++) this.ring[i] = s[`${k}.${i}`] ?? this.y;
  }
}

export class BoilerIslandModel implements ISimModel {
  readonly id = 'thermal-boiler-island';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'BLR_DRUM_LEVEL_01', // mm
    'BLR_STEAM_FLOW_01', // t/h (hơi sinh ra)
    'BLR_FW_FLOW_01', // t/h
    'BLR_COAL_FLOW_01', // t/h
    'BLR_MSTM_SH_PRESS_01', // MPa
    'BLR_MSTM_SH_TEMP_01', // °C
    'BLR_FLUE_O2_01', // %
    'BLR_FURN_PRESS_01', // Pa
    'GEN_MW_01', // MW (turbine đơn giản hoá)
  ];

  // Trạng thái tích phân
  private massLevel = 0; // mm — thành phần khối lượng nước
  private pressure = 0; // MPa — áp hơi chính (tích phân gen−draw)
  private coalFlow = 0; // t/h
  private millsAvailable = MILLS_RUNNING;
  private leak = 0; // t/h — tube leak (malfunction)

  private readonly steam = new Foptd(TAU_STEAM, TH_STEAM, 0.1);
  private readonly o2 = new Foptd(TAU_O2, TH_O2, 0.1);
  private readonly shTemp = new Foptd(TAU_SH, TH_SH, 0.1);
  private readonly furnace = new Foptd(TAU_FURN, TH_FURN, 0.1);
  private rng = new Lcg(SIM_SEED);

  init(_ctx?: ISimModelContext, config?: unknown): void {
    const ws = readWarmStart(config);
    this.massLevel = 0;
    this.pressure = ws.pressure;
    this.coalFlow = ws.coalFlow;
    this.millsAvailable = MILLS_RUNNING;
    this.leak = 0;
    this.steam.reset(ws.steamGen);
    this.o2.reset(ws.o2);
    this.shTemp.reset(ws.shTemp);
    this.furnace.reset(DRAFT_NOM_PA);
    this.rng = new Lcg(SIM_SEED);
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dtSec = ctx.dtMs / 1000;

    // ── Đầu vào điều khiển (OP của các loop; mặc định 0 khi chạy độc lập) ──
    const fuelDem = clamp(ctx.getTag('BLR_FUEL_DEMAND_01'), 0, 100); // %
    const fdDamper = clamp(ctx.getTag('BLR_FD_DAMPER_01'), 0, 100); // %
    const idVane = clamp(ctx.getTag('BLR_ID_VANE_01'), 0, 100); // %
    const sprayCv = clamp(ctx.getTag('BLR_SH_SPRAY_CV_01'), 0, 100); // %
    const fwCv = clamp(ctx.getTag('BLR_FW_CV_01'), 0, 100); // %
    const turbineDem = Math.max(0, ctx.getTag('BLR_TURBINE_DEMAND_01')); // t/h hơi lấy đi (tải)

    // ── Nhiên liệu: feeder/mill có quán tính; công suất giới hạn số mill còn chạy ──
    const coalCap = this.millsAvailable * MILL_TPH;
    const coalTarget = clamp((fuelDem / 100) * COAL_MAX_TPH, 0, coalCap);
    this.coalFlow += (dtSec / TAU_COAL_ACT) * (coalTarget - this.coalFlow);

    // ── Gió & O₂ (air/fuel ratio → excess air) ──
    const airFlow = (fdDamper / 100) * AIR_MAX_TPH; // t/h
    const lambda = airFlow / Math.max(1e-3, this.coalFlow * AF_STOICH);
    const o2Target = clamp(21 * (1 - 1 / Math.max(lambda, 1e-3)), 0, 21);
    const o2Now = this.o2.step(o2Target, dtSec);

    // ── Cháy → nhiệt → hơi (η giảm khi O₂ lệch 3,2% hoặc tải thấp) ──
    const loadFrac = this.coalFlow / COAL_MAX_TPH;
    const eta = clamp(
      ETA_COMB_MAX * (1 - K_O2_PENALTY * (o2Now - O2_NOM_PCT) ** 2) * (0.9 + 0.1 * loadFrac),
      0.4,
      ETA_COMB_MAX,
    );
    const heatKw = (this.coalFlow * 1000) / 3600 * LHV_KJ_PER_KG * eta; // kW
    const steamGenTarget = (heatKw / DH_EVAP_KJKG) * 3.6; // t/h
    const steamGen = this.steam.step(steamGenTarget, dtSec);

    // ── Feedwater & cân bằng khối lượng bao hơi ──
    const fw = Math.max(0, (fwCv / 100) * FW_MAX_TPH - this.leak);
    const dtH = dtSec / 3600;
    this.massLevel += (fw - steamGen) * dtH * K_AREA;

    // ── Áp hơi chính: tích phân (gen − draw); swell/shrink theo −dP/dt ──
    const prevP = this.pressure;
    this.pressure = clamp(this.pressure + (steamGen - turbineDem) * K_PRESS * dtSec, 0, 22);
    const dPdt = (this.pressure - prevP) / dtSec;
    const level = this.massLevel + K_SWELL_P * -dPdt;

    // ── Nhiệt độ hơi SH (spray attemperator) ──
    const tTarget = T_FIRE_BASE + T_FIRE_SPAN * loadFrac - K_SPRAY * (sprayCv / 100);
    const shTempNow = this.shTemp.step(tTarget, dtSec);

    // ── Áp buồng lửa (balanced draft: FD đẩy vào, ID hút ra) ──
    const furnTarget = DRAFT_NOM_PA + K_DRAFT * (fdDamper - idVane);
    const furnNow = this.furnace.step(furnTarget, dtSec);

    // ── Công suất (turbine đơn giản hoá: MW ∝ hơi lấy đi) ──
    const mw = turbineDem * MW_PER_TPH;

    // ── Nhiễu đo có seed (thứ tự rút cố định để tất định) ──
    const m = (v: number, amp: number): number => v + this.rng.sym(amp);
    return {
      outputs: [
        { tagId: 'BLR_DRUM_LEVEL_01', value: m(level, N_LEVEL), quality: 'Good' },
        { tagId: 'BLR_STEAM_FLOW_01', value: m(steamGen, N_FLOW), quality: 'Good' },
        { tagId: 'BLR_FW_FLOW_01', value: m(fw, N_FLOW), quality: 'Good' },
        { tagId: 'BLR_COAL_FLOW_01', value: m(this.coalFlow, N_COAL), quality: 'Good' },
        { tagId: 'BLR_MSTM_SH_PRESS_01', value: m(this.pressure, N_PRESS), quality: 'Good' },
        { tagId: 'BLR_MSTM_SH_TEMP_01', value: m(shTempNow, N_TEMP), quality: 'Good' },
        { tagId: 'BLR_FLUE_O2_01', value: m(o2Now, N_O2), quality: 'Good' },
        { tagId: 'BLR_FURN_PRESS_01', value: m(furnNow, N_FURN), quality: 'Good' },
        { tagId: 'GEN_MW_01', value: m(mw, N_MW), quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    const state: Record<string, number> = {
      massLevel: this.massLevel,
      pressure: this.pressure,
      coalFlow: this.coalFlow,
      millsAvailable: this.millsAvailable,
      leak: this.leak,
      rng: this.rng.state,
    };
    this.steam.dump(state, 'steam');
    this.o2.dump(state, 'o2');
    this.shTemp.dump(state, 'sh');
    this.furnace.dump(state, 'furn');
    return { state };
  }

  restore(snapshot: ISimSnapshot): void {
    const s = snapshot.state;
    this.massLevel = s.massLevel ?? 0;
    this.pressure = s.pressure ?? 0;
    this.coalFlow = s.coalFlow ?? 0;
    this.millsAvailable = s.millsAvailable ?? MILLS_RUNNING;
    this.leak = s.leak ?? 0;
    this.rng.state = s.rng ?? SIM_SEED;
    this.steam.load(s, 'steam');
    this.o2.load(s, 'o2');
    this.shTemp.load(s, 'sh');
    this.furnace.load(s, 'furn');
  }

  injectMalfunction(mf: IMalfunction): void {
    if (mf.id === 'tube-leak') this.leak = mf.params?.rate ?? 50;
    else if (mf.id === 'mill-trip') this.millsAvailable = Math.max(0, this.millsAvailable - 1);
  }

  clearMalfunction(id: string): void {
    if (id === 'tube-leak') this.leak = 0;
    else if (id === 'mill-trip') this.millsAvailable = MILLS_RUNNING;
  }

  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

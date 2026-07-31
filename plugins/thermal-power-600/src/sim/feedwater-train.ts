// Plugin thermal-power-600 — FeedwaterTrainModel (ISimModel, doc 10 §6 — gia nhiệt HỒI NHIỆT
// regenerative + heat rate chu trình). CHỈ import @idtp/sdk. CHIỀU SÂU vật lý bổ sung (v1.19), chạy
// CẠNH boiler/turbine/reheat: đọc lưu lượng hơi/công suất/chân không/nhiệt reheater tươi → sinh THÊM
// tag đoàn gia nhiệt nước cấp (condensate → 4 LP heater → deaerator → BFP → 3 HP heater → economizer)
// + heat rate chu trình turbine. ADDITIVE — không đổi tag boiler/turbine (0 hồi quy). Tất định.
//
// Neo Design Basis (Phụ lục A): nhiệt nước cấp vào economizer 283 °C · deaerator 0,9 MPa/178 °C ·
// condensate ~34 °C (bão hoà ở chân không 5,4 kPa) · 3 HP + 4 LP heater · BMCR 2.008 t/h · 600 MW.
// Đường cong regen theo tải, cp nước, enthalpy hơi/nước cấp = [GIẢ ĐỊNH] (GĐ-66) — số heat-balance
// thật thay khi có. Heat rate ở đây là "chu trình turbine" (nhiệt cấp cho hơi / công suất gross), KHÁC
// heat rate ĐƠN VỊ 9.200 kJ/kWh (gồm hiệu suất lò + tự dùng) — nêu rõ, không nhầm.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

/* ── Design Basis (Phụ lục A) ── */
const T_ECON_NOM_C = 283; // nhiệt nước cấp vào economizer (đầu ra đoàn HP heater)
const T_DEA_NOM_C = 178; // deaerator 0,9 MPa bão hoà
const T_COND_NOM_C = 34; // condensate/hotwell ~ bão hoà ở 5,4 kPa
const VACUUM_NOM_KPA = 5.4;
const BMCR_STEAM_TPH = 2008;
const MW_GROSS = 600;

/* ── [GIẢ ĐỊNH] hiệu chỉnh (GĐ-66) ── */
const K_VAC_C_PER_KPA = 2; // condensate nóng lên khi mất chân không
const CP_WATER_KJKGK = 4.4; // nhiệt dung riêng nước cấp trung bình (dải 34–283 °C)
const DH_BOILER_KJKG = 2145; // h(hơi chính 17,5/541) − h(nước cấp 283 °C) ≈ 3395 − 1250
const TAU_FW_S = 40; // quán tính nhiệt đoàn gia nhiệt
/* ── Mức bình khử khí (deaerator level control) — GĐ-80 ── */
const DEA_STORAGE_T = 300; // sức chứa bể deaerator (t) — quy mô mức % [GIẢ ĐỊNH]
const COND_SUPPLY_MAX_TPH = 2200; // lưu lượng condensate tối đa qua van mức deaerator (LCV 100%)
/* ── Áp suất bình khử khí (deaerator pressure control — pegging steam) — GĐ-84 ── */
const P_DEA_SP_MPA = 0.9; // setpoint áp deaerator (Design Basis 0,9 MPa/178 °C)
const P_DEA_EXTRACT_MAX_MPA = 1.0; // áp hơi trích (extraction) ở đầy tải — tụt theo tải xuống non tải
const K_PEG_MPA = 0.5; // đóng góp áp toàn hành trình van pegging steam (bù khi hơi trích thiếu)
/* ── Áp header hơi phụ trợ (auxiliary steam header — PRDS) — GĐ-87 ── */
const P_AUX_MIN_MPA = 0.5; // áp header phụ trợ nền khi van PRDS đóng
const K_AUX_PRDS_MPA = 1.6; // đóng góp áp toàn hành trình van giảm áp PRDS → giữ 1,3 MPa ở ~50%

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
// Phần hồi nhiệt đạt được theo tải (extraction ∝ tải; sàn 0,5 do LP+deaerator luôn hoạt động).
function regenFraction(loadFrac: number): number {
  return clamp(0.5 + 0.5 * loadFrac, 0, 1);
}

export class FeedwaterTrainModel implements ISimModel {
  readonly id = 'thermal-feedwater-train';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'FW_FLOW_01', // t/h — lưu lượng nước cấp (= hơi, cân bằng khối lượng)
    'FW_CONDENSATE_TEMP_01', // °C — condensate/hotwell
    'FW_DEAERATOR_TEMP_01', // °C — sau đoàn LP heater + deaerator
    'FW_ECON_INLET_TEMP_01', // °C — nước cấp vào economizer (neo DB 283)
    'FW_REGEN_DUTY_01', // MWth — nhiệt hồi nhiệt cấp cho nước cấp
    'PLANT_CYCLE_HR_01', // kJ/kWh — heat rate chu trình turbine (khác heat rate đơn vị)
    // Chiều sâu SCADA: nhiệt đầu ra TỪNG bình gia nhiệt — 4 LP heater (condensate→deaerator) + 3 HP
    // heater (deaerator→economizer). Chia bậc theo enthalpy đều [GIẢ ĐỊNH] GĐ-74 — cùng physics hồi
    // nhiệt, chỉ tính ở nhiều nút hơn (KHÔNG bịa: nội suy tuyến tính giữa các nút vật lý đã có).
    'FW_LPH1_TEMP_01',
    'FW_LPH2_TEMP_01',
    'FW_LPH3_TEMP_01',
    'FW_LPH4_TEMP_01',
    'FW_HPH1_TEMP_01',
    'FW_HPH2_TEMP_01',
    'FW_HPH3_TEMP_01',
    'FW_DEAERATOR_LEVEL_01', // % — mức bể khử khí (điều khiển bằng LCV condensate)
    'FW_DEA_PRESS_01', // MPa — áp bể khử khí (hơi trích + pegging steam giữ 0,9 MPa)
    'FW_AUX_STEAM_PRESS_01', // MPa — áp header hơi phụ trợ (PRDS giữ 1,3 MPa: pegging/sootblow/atomizing)
  ];

  private tCond = T_COND_NOM_C;
  private tDea = T_DEA_NOM_C;
  private tEcon = T_ECON_NOM_C;
  private hpHeaterTrip = false; // malfunction: bypass đoàn gia nhiệt cao áp → nước cấp vào econ nguội đi → heat rate xấu
  private deaLevel = 50; // % — mức bể khử khí (tích phân condensate vào − nước cấp ra)

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.tCond = T_COND_NOM_C;
    this.tDea = T_DEA_NOM_C;
    this.tEcon = T_ECON_NOM_C;
    this.hpHeaterTrip = false;
    this.deaLevel = 50;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dt = ctx.dtMs / 1000;
    const steam = Math.max(0, ctx.getTag('BLR_STEAM_FLOW_01')); // t/h
    const mw = Math.max(0, ctx.getTag('GEN_MW_01')); // MW gross
    const vacuum = Math.max(0, ctx.getTag('TRB_COND_VACUUM_01')); // kPa(a)
    const reheatDuty = Math.max(0, ctx.getTag('TRB_REHEAT_DUTY_01')); // MWth
    const loadFrac = clamp(steam / BMCR_STEAM_TPH, 0, 1.1);
    const reg = regenFraction(loadFrac);

    // Nhiệt các mốc đoàn gia nhiệt bám mục tiêu (lag quán tính nhiệt).
    const condTarget = T_COND_NOM_C + (vacuum - VACUUM_NOM_KPA) * K_VAC_C_PER_KPA;
    const deaTarget = condTarget + (T_DEA_NOM_C - T_COND_NOM_C) * reg;
    // Bypass HP heater → nước cấp vào economizer chỉ còn nhiệt sau deaerator (mất phần gia nhiệt cao áp).
    const econTarget = this.hpHeaterTrip ? deaTarget : condTarget + (T_ECON_NOM_C - T_COND_NOM_C) * reg;
    this.tCond += (condTarget - this.tCond) * (dt / TAU_FW_S);
    this.tDea += (deaTarget - this.tDea) * (dt / TAU_FW_S);
    this.tEcon += (econTarget - this.tEcon) * (dt / TAU_FW_S);

    // Nhiệt hồi nhiệt cấp cho nước cấp (MWth) = ṁ·cp·ΔT; ṁ = steam/3,6 kg/s.
    const mdot = steam / 3.6; // kg/s
    const regenDuty = (mdot * CP_WATER_KJKGK * Math.max(0, this.tEcon - this.tCond)) / 1000;

    // Heat rate chu trình turbine (kJ/kWh) = nhiệt cấp cho hơi / công suất gross.
    // Nhiệt cấp = ṁ·Δh_boiler(nước cấp→hơi chính) + nhiệt reheater. Nước cấp CÀNG NÓNG → nhiệt cấp
    // càng ÍT → heat rate tốt hơn (lợi ích hồi nhiệt hiện rõ qua chính con số này).
    const boilerDutyKw = mdot * DH_BOILER_KJKG + reheatDuty * 1000; // kW
    const cycleHr = mw > 1 ? (boilerDutyKw * 3600) / (mw * 1000) : 0; // kJ/kWh

    // Nhiệt đầu ra từng bình gia nhiệt — bậc đều giữa hai nút vật lý đã lag (đơn điệu tăng, tất định):
    // 4 LP heater chia condensate→deaerator; 3 HP heater chia deaerator→economizer.
    const lp = (k: number): number => this.tCond + ((this.tDea - this.tCond) * k) / 4;
    const hp = (k: number): number => this.tDea + ((this.tEcon - this.tDea) * k) / 3;

    // Mức bể khử khí: tích phân (condensate VÀO qua LCV − nước cấp RA = hơi, cân bằng khối lượng). Loop
    // 'deaerator-level' điều LCV giữ mức 50%. Ở ổn định: condensate vào = nước cấp ra → mức đứng yên.
    const lcv = clamp(ctx.getTag('FW_DEA_LCV_01'), 0, 100);
    const condIn = (lcv / 100) * COND_SUPPLY_MAX_TPH; // t/h
    const dLevel = ((condIn - steam) / DEA_STORAGE_T) * 100 * (dt / 3600); // %/bước
    this.deaLevel = clamp(this.deaLevel + dLevel, 0, 100);

    // Áp bể khử khí: hơi TRÍCH (extraction) từ turbine ∝ tải — non tải tụt dưới setpoint; van PEGGING
    // steam (từ nguồn áp cao hơn) bù lên 0,9 MPa. Loop 'deaerator-pressure' điều van pegging (direct:
    // áp thấp → mở thêm). Ở điểm vận hành hơi trích ~0,75·1,0 = 0,75 MPa → pegging mở ~30% bù tới 0,9.
    const peg = clamp(ctx.getTag('FW_DEA_PEG_VALVE_01'), 0, 100);
    const pExtract = clamp(P_DEA_EXTRACT_MAX_MPA * loadFrac, 0, P_DEA_EXTRACT_MAX_MPA);
    const deaPress = pExtract + (peg / 100) * K_PEG_MPA;

    // Áp header hơi PHỤ TRỢ (PRDS): van giảm áp từ hơi chính/tái nhiệt lạnh → giữ 1,3 MPa cấp cho pegging
    // deaerator, thổi bụi (sootblow), phun sương dầu khởi động. Loop 'aux-steam-header' (direct) giữ header.
    const prds = clamp(ctx.getTag('FW_AUX_PRDS_VALVE_01'), 0, 100);
    const auxSteamPress = P_AUX_MIN_MPA + (prds / 100) * K_AUX_PRDS_MPA;

    return {
      outputs: [
        { tagId: 'FW_FLOW_01', value: steam, quality: 'Good' },
        { tagId: 'FW_CONDENSATE_TEMP_01', value: this.tCond, quality: 'Good' },
        { tagId: 'FW_DEAERATOR_TEMP_01', value: this.tDea, quality: 'Good' },
        { tagId: 'FW_ECON_INLET_TEMP_01', value: this.tEcon, quality: 'Good' },
        { tagId: 'FW_REGEN_DUTY_01', value: regenDuty, quality: 'Good' },
        { tagId: 'PLANT_CYCLE_HR_01', value: cycleHr, quality: 'Good' },
        { tagId: 'FW_LPH1_TEMP_01', value: lp(1), quality: 'Good' },
        { tagId: 'FW_LPH2_TEMP_01', value: lp(2), quality: 'Good' },
        { tagId: 'FW_LPH3_TEMP_01', value: lp(3), quality: 'Good' },
        { tagId: 'FW_LPH4_TEMP_01', value: lp(4), quality: 'Good' },
        { tagId: 'FW_HPH1_TEMP_01', value: hp(1), quality: 'Good' },
        { tagId: 'FW_HPH2_TEMP_01', value: hp(2), quality: 'Good' },
        { tagId: 'FW_HPH3_TEMP_01', value: hp(3), quality: 'Good' },
        { tagId: 'FW_DEAERATOR_LEVEL_01', value: this.deaLevel, quality: 'Good' },
        { tagId: 'FW_DEA_PRESS_01', value: deaPress, quality: 'Good' },
        { tagId: 'FW_AUX_STEAM_PRESS_01', value: auxSteamPress, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { tCond: this.tCond, tDea: this.tDea, tEcon: this.tEcon, hpHeaterTrip: this.hpHeaterTrip ? 1 : 0, deaLevel: this.deaLevel } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.tCond = snapshot.state.tCond ?? T_COND_NOM_C;
    this.tDea = snapshot.state.tDea ?? T_DEA_NOM_C;
    this.tEcon = snapshot.state.tEcon ?? T_ECON_NOM_C;
    this.hpHeaterTrip = (snapshot.state.hpHeaterTrip ?? 0) > 0;
    this.deaLevel = snapshot.state.deaLevel ?? 50;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'hp-heater-trip') this.hpHeaterTrip = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'hp-heater-trip') this.hpHeaterTrip = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

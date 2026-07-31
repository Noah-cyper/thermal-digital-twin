// Plugin thermal-power-600 — FlueGasAirModel (ISimModel, doc 10 §6 — đường khói + gió cháy + hiệu suất
// lò). CHỈ import @idtp/sdk. CHIỀU SÂU vật lý bổ sung (v1.21), chạy CẠNH boiler/…/feedwater: đọc lưu
// lượng than/O₂/công suất/heat rate chu trình tươi → khép kín phía KHÓI-GIÓ: gió thừa, lưu lượng khói,
// nhiệt air heater/ống khói, tổn thất khói khô, và HIỆU SUẤT LÒ (nhiệt vào hơi / nhiệt nhiên liệu).
// ADDITIVE — không ghi đè tag boiler (0 hồi quy). Tất định (không Math.random).
//
// Neo Design Basis (Phụ lục A): than bituminous LHV 21.500 kJ/kg · tro 15% · ẩm 10% · O₂ danh định
// 3,2% · air heater 2×Ljungström · ống khói 210 m. Nhiệt air heater/ống khói, cp khói, độ hữu hiệu AH,
// nhiệt môi trường = [GIẢ ĐỊNH] (GĐ-68). Heat rate ĐƠN VỊ = HR chu trình / hiệu suất lò (≈8.940/0,88 ≈
// 10.150 kJ/kWh gross); Design Basis 9.200 (net, 39%) hàm ý η chu trình cao hơn hằng số [GIẢ ĐỊNH] hiện
// tại — chênh này là hạng mục HIỆU CHỈNH bằng heat balance thật, không phải lỗi (nêu rõ, GĐ-68).
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

/* ── Design Basis (Phụ lục A) — khớp hằng số boiler ── */
const LHV_KJ_PER_KG = 21_500;
const AF_STOICH = 10.0; // kg gió / kg than (hoá học)
const COAL_MAX_TPH = 300; // 5 mill × 60 t/h

/* ── [GIẢ ĐỊNH] hiệu chỉnh (GĐ-68) ── */
const T_AMB_C = 30; // gió môi trường vào
const T_AH_GAS_IN_NOM_C = 350; // khói vào air heater (ra economizer) ở đầy tải
const T_STACK_NOM_C = 130; // khói ra ống khói ở đầy tải
const AH_EFF = 0.84; // độ hữu hiệu air heater
const CP_FG_KJKGK = 1.05; // nhiệt dung riêng khói
const TAU_FG_S = 25; // quán tính nhiệt air heater

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class FlueGasAirModel implements ISimModel {
  readonly id = 'thermal-fluegas-air';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'BLR_EFF_01', // % — hiệu suất lò (nhiệt vào hơi / nhiệt nhiên liệu)
    'FG_EXCESS_AIR_01', // % — gió thừa (từ O₂)
    'FG_LAMBDA_01', // — tỷ số gió λ
    'FG_FLOW_01', // t/h — lưu lượng khói
    'FG_AH_GAS_IN_TEMP_01', // °C — khói vào air heater (ra economizer)
    'FG_STACK_TEMP_01', // °C — khói ra ống khói
    'AH_AIR_OUT_TEMP_01', // °C — gió cháy sau air heater
    'FG_DRYGAS_LOSS_01', // % — tổn thất khói khô
    // Chiều sâu SCADA: 2 quạt gió FD (A/B, mỗi quạt 50% lưu lượng gió) + 2 quạt khói ID (A/B, mỗi quạt
    // 50% lưu lượng khói) — chia đều tổng ĐÃ TÍNH cho cặp quạt song song (KHÔNG bịa, không thêm trạng thái).
    'FG_FDA_FLOW_01',
    'FG_FDB_FLOW_01',
    'FG_IDA_FLOW_01',
    'FG_IDB_FLOW_01',
  ];

  private tGasIn = T_AH_GAS_IN_NOM_C;
  private tStack = T_STACK_NOM_C;
  private tAirOut = 290;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.tGasIn = T_AH_GAS_IN_NOM_C;
    this.tStack = T_STACK_NOM_C;
    this.tAirOut = 290;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dt = ctx.dtMs / 1000;
    const coal = Math.max(0, ctx.getTag('BLR_COAL_FLOW_01')); // t/h
    const o2 = clamp(ctx.getTag('BLR_FLUE_O2_01'), 0, 20.9); // %
    const mw = Math.max(0, ctx.getTag('GEN_MW_01')); // MW
    const hr = Math.max(0, ctx.getTag('PLANT_CYCLE_HR_01')); // kJ/kWh — heat rate chu trình
    const loadFrac = clamp(coal / COAL_MAX_TPH, 0, 1.1);
    const firing = coal > 5; // đang cháy

    // Gió thừa & λ từ O₂: excess = O₂/(21−O₂); λ = 21/(21−O₂).
    const lambda = 21 / Math.max(1e-3, 21 - o2);
    const excess = (o2 / Math.max(1e-3, 21 - o2)) * 100;
    // Lưu lượng khói = than + gió cháy = than·(1 + AFR); AFR = AF_STOICH·λ.
    const fgFlow = firing ? coal * (1 + AF_STOICH * lambda) : 0;
    // Gió cháy = khói − than (bảo toàn khối lượng); mỗi quạt trong cặp song song gánh một nửa.
    const airFlow = firing ? Math.max(0, fgFlow - coal) : 0;

    // Nhiệt đường khói bám mục tiêu theo tải (lag air heater). Không cháy → nguội về môi trường.
    const gasInTarget = firing ? T_AMB_C + (T_AH_GAS_IN_NOM_C - T_AMB_C) * (0.6 + 0.4 * clamp(loadFrac, 0, 1)) : T_AMB_C;
    const stackTarget = firing ? T_AMB_C + (T_STACK_NOM_C - T_AMB_C) * (0.6 + 0.4 * clamp(loadFrac, 0, 1)) : T_AMB_C;
    this.tGasIn += (gasInTarget - this.tGasIn) * (dt / TAU_FG_S);
    this.tStack += (stackTarget - this.tStack) * (dt / TAU_FG_S);
    const airOutTarget = T_AMB_C + AH_EFF * (this.tGasIn - T_AMB_C); // gió nhận nhiệt từ khói
    this.tAirOut += (airOutTarget - this.tAirOut) * (dt / TAU_FG_S);

    // Hiệu suất lò (trực tiếp): nhiệt vào hơi / nhiệt nhiên liệu.
    const qFuelKw = firing ? (coal / 3.6) * LHV_KJ_PER_KG : 0; // kW
    const qSteamKw = (hr * mw) / 3.6; // kW (= HR·gross/3600·1000)
    const boilerEff = qFuelKw > 1 ? clamp((qSteamKw / qFuelKw) * 100, 0, 100) : 0;

    // Tổn thất khói khô = ṁ_khói·cp·(T_ống khói − T_môi trường) / nhiệt nhiên liệu.
    const dryGasLoss = qFuelKw > 1 ? ((fgFlow / 3.6) * CP_FG_KJKGK * Math.max(0, this.tStack - T_AMB_C)) / qFuelKw * 100 : 0;

    return {
      outputs: [
        { tagId: 'BLR_EFF_01', value: boilerEff, quality: 'Good' },
        { tagId: 'FG_EXCESS_AIR_01', value: excess, quality: 'Good' },
        { tagId: 'FG_LAMBDA_01', value: lambda, quality: 'Good' },
        { tagId: 'FG_FLOW_01', value: fgFlow, quality: 'Good' },
        { tagId: 'FG_AH_GAS_IN_TEMP_01', value: this.tGasIn, quality: 'Good' },
        { tagId: 'FG_STACK_TEMP_01', value: this.tStack, quality: 'Good' },
        { tagId: 'AH_AIR_OUT_TEMP_01', value: this.tAirOut, quality: 'Good' },
        { tagId: 'FG_DRYGAS_LOSS_01', value: dryGasLoss, quality: 'Good' },
        { tagId: 'FG_FDA_FLOW_01', value: airFlow / 2, quality: 'Good' },
        { tagId: 'FG_FDB_FLOW_01', value: airFlow / 2, quality: 'Good' },
        { tagId: 'FG_IDA_FLOW_01', value: fgFlow / 2, quality: 'Good' },
        { tagId: 'FG_IDB_FLOW_01', value: fgFlow / 2, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { tGasIn: this.tGasIn, tStack: this.tStack, tAirOut: this.tAirOut } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.tGasIn = snapshot.state.tGasIn ?? T_AH_GAS_IN_NOM_C;
    this.tStack = snapshot.state.tStack ?? T_STACK_NOM_C;
    this.tAirOut = snapshot.state.tAirOut ?? 290;
  }
  injectMalfunction(_m: IMalfunction): void {
    // model không có malfunction riêng ở v1.21
  }
  clearMalfunction(_id: string): void {
    // không giữ trạng thái malfunction
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

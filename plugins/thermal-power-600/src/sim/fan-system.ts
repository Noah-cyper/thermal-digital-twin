// Plugin thermal-power-600 — FanSystemModel (ISimModel, doc 10 §6 — hệ QUẠT gió-khói: FD/ID/PA + surge margin).
// CHỈ import @idtp/sdk. CHIỀU SÂU quạt: điểm vận hành trên ĐƯỜNG ĐẶC TÍNH quạt (lưu lượng ↔ cột áp) + BIÊN
// SURGE — quạt ly tâm/hướng trục khi lưu lượng tụt quá thấp (cột áp cao) rơi vào vùng SURGE: dao động dòng
// mạnh, rung, hư cánh. FD (gió cưỡng bức) · ID (khói cảm ứng, giữ chân không buồng lửa) · PA (gió sơ cấp mill).
// Đọc BLR_FD_DAMPER_01 / BLR_ID_VANE_01 / COAL_PA_HEADER_PRESS_01 → lưu lượng/cột áp/dòng điện/biên surge.
//
// ADDITIVE — sinh tag FAN_* ĐỘC LẬP; KHÔNG đổi tag gió-khói lõi (0 hồi quy). Tất định (không Math.random). Có
// TRẠNG THÁI (cờ sự cố) → snapshot/restore. Malfunction: 'fd-fan-surge' (FD tụt lưu lượng → vào surge) ·
// 'id-fan-stall' (ID stall → mất chân không buồng lửa) · 'fan-inlet-block' (tắc cửa hút → cả FD/ID tụt).
//
// Neo Design Basis (Phụ lục A §2): 2×50% FD + 2×50% ID + 2×50% PA. Đường surge ~25% lưu lượng định mức. Hệ
// số đường đặc tính, dòng định mức, đường surge = [GIẢ ĐỊNH].
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const SURGE_LINE_PCT = 25; // % — lưu lượng dưới ngưỡng này = vùng surge
const HEAD_INTERCEPT = 118; // % — cột áp ở lưu lượng 0 (đường đặc tính giảm dần)
const HEAD_SLOPE = 0.62; // %cột-áp / %lưu-lượng (dốc đường đặc tính)
const CURRENT_RATED_A = 320; // A — dòng động cơ quạt định mức
const SURGE_MARGIN_HEALTHY_MIN = 10; // % — biên surge lành mạnh
const FD_SURGE_FLOW = 12; // % — lưu lượng FD khi bị đẩy vào surge
const ID_STALL_FLOW = 14; // % — lưu lượng ID khi stall
const PA_NOM_KPA = 9; // kPa — áp header PA danh định

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
function headAt(flowPct: number): number {
  return clamp(HEAD_INTERCEPT - HEAD_SLOPE * flowPct, 15, 130);
}

export class FanSystemModel implements ISimModel {
  readonly id = 'thermal-fan-system';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'FAN_FD_FLOW_01', // % — lưu lượng quạt FD
    'FAN_FD_HEAD_01', // % — cột áp FD
    'FAN_FD_CURRENT_01', // A — dòng động cơ FD
    'FAN_FD_SURGE_MARGIN_01', // % — biên surge FD
    'FAN_ID_FLOW_01', // % — lưu lượng quạt ID
    'FAN_ID_HEAD_01', // % — cột áp ID
    'FAN_ID_SURGE_MARGIN_01', // % — biên surge ID
    'FAN_PA_FLOW_01', // % — lưu lượng quạt PA
    'FAN_MIN_SURGE_MARGIN_01', // % — biên surge nhỏ nhất (FD/ID)
    'FAN_HEALTHY_01', // 0/1 — hệ quạt bình thường
  ];

  private fdSurge = false;
  private idStall = false;
  private inletBlock = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.fdSurge = false;
    this.idStall = false;
    this.inletBlock = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const fdDamper = clamp(ctx.getTag('BLR_FD_DAMPER_01'), 0, 100);
    const idVane = clamp(ctx.getTag('BLR_ID_VANE_01'), 0, 100);
    const paPress = ctx.getTag('COAL_PA_HEADER_PRESS_01') || PA_NOM_KPA;
    const blockFactor = this.inletBlock ? 0.35 : 1; // tắc cửa hút → lưu lượng tụt

    // Lưu lượng ≈ vị trí damper/vane (điều tiết lưu lượng); sự cố ép lưu lượng xuống vùng surge.
    const fdFlow = this.fdSurge ? FD_SURGE_FLOW : fdDamper * blockFactor;
    const idFlow = this.idStall ? ID_STALL_FLOW : idVane * blockFactor;
    const paFlow = clamp((paPress / PA_NOM_KPA) * 60, 0, 100); // header → lưu lượng PA

    const fdHead = headAt(fdFlow);
    const idHead = headAt(idFlow);
    const fdCurrent = CURRENT_RATED_A * (fdFlow / 100) * (fdHead / 100) + 40;

    const fdMargin = fdFlow - SURGE_LINE_PCT;
    const idMargin = idFlow - SURGE_LINE_PCT;
    const minMargin = Math.min(fdMargin, idMargin);
    const healthy = minMargin >= SURGE_MARGIN_HEALTHY_MIN ? 1 : 0;

    return {
      outputs: [
        { tagId: 'FAN_FD_FLOW_01', value: fdFlow, quality: 'Good' },
        { tagId: 'FAN_FD_HEAD_01', value: fdHead, quality: 'Good' },
        { tagId: 'FAN_FD_CURRENT_01', value: fdCurrent, quality: 'Good' },
        { tagId: 'FAN_FD_SURGE_MARGIN_01', value: fdMargin, quality: 'Good' },
        { tagId: 'FAN_ID_FLOW_01', value: idFlow, quality: 'Good' },
        { tagId: 'FAN_ID_HEAD_01', value: idHead, quality: 'Good' },
        { tagId: 'FAN_ID_SURGE_MARGIN_01', value: idMargin, quality: 'Good' },
        { tagId: 'FAN_PA_FLOW_01', value: paFlow, quality: 'Good' },
        { tagId: 'FAN_MIN_SURGE_MARGIN_01', value: minMargin, quality: 'Good' },
        { tagId: 'FAN_HEALTHY_01', value: healthy, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { fdSurge: this.fdSurge ? 1 : 0, idStall: this.idStall ? 1 : 0, inletBlock: this.inletBlock ? 1 : 0 } };
  }
  restore(s: ISimSnapshot): void {
    this.fdSurge = (s.state.fdSurge ?? 0) > 0.5;
    this.idStall = (s.state.idStall ?? 0) > 0.5;
    this.inletBlock = (s.state.inletBlock ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'fd-fan-surge') this.fdSurge = true;
    if (m.id === 'id-fan-stall') this.idStall = true;
    if (m.id === 'fan-inlet-block') this.inletBlock = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'fd-fan-surge') this.fdSurge = false;
    if (id === 'id-fan-stall') this.idStall = false;
    if (id === 'fan-inlet-block') this.inletBlock = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

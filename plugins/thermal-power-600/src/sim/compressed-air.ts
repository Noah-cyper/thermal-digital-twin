// Plugin thermal-power-600 — CompressedAirModel (ISimModel, doc 10 §10 BOP — Khí nén & Khí điều khiển).
// CHỈ import @idtp/sdk. Hệ Balance-of-Plant §10: 2 máy nén (load/unload theo DẢI áp bình chứa) + sấy khí
// điều khiển (instrument air dryer → dewpoint). Nhu cầu khí ∝ tải (cơ cấu điều khiển khí nén) + nền.
// ADDITIVE — sinh tag CA_* độc lập; đọc GEN_MW_01 suy nhu cầu. Tất định (không Math.random). Có TRẠNG
// THÁI (áp bình chứa + trạng thái load/unload) → snapshot/restore cho OTS.
//
// [GIẢ ĐỊNH] GĐ-89: dải áp 6,8–7,5 barg · suất máy nén 60 Nm³/min · dewpoint sấy −40 °C · nhu cầu khí
// nền 25 + 55·tải Nm³/min = hiệu chỉnh theo khảo sát khí nén thật khi có.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const P_LOAD_BARG = 6.8; // < ngưỡng → máy nén LOAD (nạp)
const P_UNLOAD_BARG = 7.5; // > ngưỡng → máy nén UNLOAD (xả tải, trễ chống dao động)
const COMP_CAP_NM3MIN = 60; // suất 1 máy nén
const RECEIVER_K = 1500; // hệ số quy mô động học áp bình chứa (Nm³ → barg/s)
const IA_DRYER_DROP_BARG = 0.2; // sụt áp qua bộ sấy khí điều khiển
const IA_DEWPOINT_C = -40; // dewpoint khí điều khiển (sấy hấp phụ)

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class CompressedAirModel implements ISimModel {
  readonly id = 'thermal-compressed-air';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'CA_RECEIVER_PRESS_01', // barg — áp bình chứa khí nén
    'CA_SA_HEADER_PRESS_01', // barg — header khí dịch vụ (service air)
    'CA_IA_HEADER_PRESS_01', // barg — header khí điều khiển (instrument air, sau sấy)
    'CA_IA_DEWPOINT_01', // °C — dewpoint khí điều khiển
    'CA_COMP_RUNNING_01', // — số máy nén đang tải
    'CA_COMP_A_LOAD_01', // % — tải máy nén A
    'CA_COMP_B_LOAD_01', // % — tải máy nén B
    'CA_DEMAND_01', // Nm³/min — nhu cầu khí nén
  ];

  private receiver = 7.1; // barg
  private loaded = true;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.receiver = 7.1;
    this.loaded = true;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dt = ctx.dtMs / 1000;
    const loadFrac = clamp(Math.max(0, ctx.getTag('GEN_MW_01')) / 600, 0, 1.1);
    const demand = 25 + 55 * loadFrac; // Nm³/min — nền + biến thiên theo tải
    const anyDemand = demand > 1;

    // Lead–lag: máy nén A (lead) luôn chạy khi có nhu cầu; máy nén B (lag/trim) load/unload theo TRỄ
    // (hysteresis) giữ áp bình chứa trong dải — A một mình chưa đủ ở tải cao nên B nạp/xả quanh dải.
    if (this.receiver < P_LOAD_BARG) this.loaded = true;
    else if (this.receiver > P_UNLOAD_BARG) this.loaded = false;
    const trimOn = anyDemand && this.loaded;

    const supply = (anyDemand ? COMP_CAP_NM3MIN : 0) + (trimOn ? COMP_CAP_NM3MIN : 0);
    // Áp bình chứa = tích phân (cấp − tiêu).
    this.receiver = clamp(this.receiver + ((supply - demand) / RECEIVER_K) * dt, 5.5, 8.5);

    const running = (anyDemand ? 1 : 0) + (trimOn ? 1 : 0);
    const perComp = running > 0 ? clamp((demand / running / COMP_CAP_NM3MIN) * 100, 0, 100) : 0;
    const iaHeader = Math.max(0, this.receiver - IA_DRYER_DROP_BARG);

    return {
      outputs: [
        { tagId: 'CA_RECEIVER_PRESS_01', value: this.receiver, quality: 'Good' },
        { tagId: 'CA_SA_HEADER_PRESS_01', value: this.receiver, quality: 'Good' },
        { tagId: 'CA_IA_HEADER_PRESS_01', value: iaHeader, quality: 'Good' },
        { tagId: 'CA_IA_DEWPOINT_01', value: IA_DEWPOINT_C, quality: 'Good' },
        { tagId: 'CA_COMP_RUNNING_01', value: running, quality: 'Good' },
        { tagId: 'CA_COMP_A_LOAD_01', value: running >= 1 ? perComp : 0, quality: 'Good' },
        { tagId: 'CA_COMP_B_LOAD_01', value: running >= 2 ? perComp : 0, quality: 'Good' },
        { tagId: 'CA_DEMAND_01', value: demand, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { receiver: this.receiver, loaded: this.loaded ? 1 : 0 } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.receiver = snapshot.state.receiver ?? 7.1;
    this.loaded = (snapshot.state.loaded ?? 1) > 0.5;
  }
  injectMalfunction(_m: IMalfunction): void {
    // model không có malfunction riêng ở v1.40
  }
  clearMalfunction(_id: string): void {
    // không giữ trạng thái malfunction
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

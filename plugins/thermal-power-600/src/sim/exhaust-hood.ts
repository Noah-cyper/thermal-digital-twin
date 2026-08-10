// Plugin thermal-power-600 — ExhaustHoodModel (ISimModel, doc 10 §6/§7). Nhiệt HOOD XẢ LP turbine: ở TẢI
// THẤP, lưu lượng hơi qua tầng cuối LP tụt → WINDAGE (ma sát cánh quạt gió trong hơi loãng) sinh nhiệt →
// hood nóng lên trên nhiệt bão hoà bình ngưng. Phun condensate làm mát khi hood vượt ngưỡng (vòng điều
// khiển `exhaust-hood-spray`, chỉ tác động ở tải thấp). CHỈ import @idtp/sdk.
//
// ADDITIVE — đọc GEN_MW_01 (proxy lưu lượng LP) + van phun `TRB_HOOD_SPRAY_VALVE_01` (từ vòng) → sinh 2 tag
// MỚI, KHÔNG đổi tag lõi. Tải thường (~75%) hood ≈ nền (mát) → van đóng → 0 hồi quy. Tất định (không
// Math.random). Malfunction `hood-spray-fail` (van phun kẹt đóng → hood quá nhiệt ở tải thấp).
//
// Neo Design Basis (Phụ lục A §3.3): tổ máy 600 MW gross. Ngưỡng windage/spray = [GIẢ ĐỊNH] GĐ-155.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const HOOD_BASE_C = 40; // °C — nhiệt hood nền (xấp xỉ bão hoà bình ngưng)
const WINDAGE_MAX_C = 65; // °C — độ tăng nhiệt windage tối đa khi lưu lượng ~0
const LOW_LOAD_FRAC = 0.2; // windage bắt đầu khi tải < 20% MCR
const SPRAY_COOL_MAX_C = 60; // °C — làm mát tối đa khi van phun 100%
const SPRAY_CAP_TPH = 20; // t/h — lưu lượng phun tối đa
const MCR_MW = 600; // MW — công suất gross định mức

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class ExhaustHoodModel implements ISimModel {
  readonly id = 'thermal-exhaust-hood';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'TRB_EXH_HOOD_TEMP_01', // °C — nhiệt hood xả LP
    'TRB_HOOD_SPRAY_FLOW_01', // t/h — lưu lượng phun làm mát hood
  ];

  private sprayFail = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.sprayFail = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const mw = Math.max(0, ctx.getTag('GEN_MW_01'));
    const loadFrac = MCR_MW > 0 ? mw / MCR_MW : 0;
    // Windage: tăng dần khi tải tụt dưới LOW_LOAD_FRAC; ≥ ngưỡng → 0 (đủ hơi cuốn nhiệt đi).
    const windage = WINDAGE_MAX_C * clamp((LOW_LOAD_FRAC - loadFrac) / LOW_LOAD_FRAC, 0, 1);
    const valve = this.sprayFail ? 0 : clamp(ctx.getTag('TRB_HOOD_SPRAY_VALVE_01'), 0, 100);
    const sprayFlow = (valve / 100) * SPRAY_CAP_TPH;
    const cooling = Math.min((valve / 100) * SPRAY_COOL_MAX_C, windage); // phun không hạ dưới nền
    const hood = HOOD_BASE_C + Math.max(0, windage - cooling);

    return {
      outputs: [
        { tagId: 'TRB_EXH_HOOD_TEMP_01', value: hood, quality: 'Good' },
        { tagId: 'TRB_HOOD_SPRAY_FLOW_01', value: sprayFlow, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { sprayFail: this.sprayFail ? 1 : 0 } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.sprayFail = (snapshot.state.sprayFail ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'hood-spray-fail') this.sprayFail = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'hood-spray-fail') this.sprayFail = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

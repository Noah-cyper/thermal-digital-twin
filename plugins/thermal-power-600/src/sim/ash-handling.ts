// Plugin thermal-power-600 — AshHandlingModel (ISimModel, doc 10 §10 BOP — Thải tro: tro đáy + tro bay).
// CHỈ import @idtp/sdk. Hệ Balance-of-Plant §10: tro ĐÁY (bottom ash, ~20% — rơi xuống đáy buồng lửa →
// SSC/băng cào) + tro BAY (fly ash, ~80% — thu ở phễu ESP → silo → xe bồn). Sản lượng tro ∝ than × tỷ lệ
// tro (15% Design Basis). ADDITIVE — sinh tag ASH_*, đọc BLR_COAL_FLOW_01. Tất định (không Math.random).
// Có TRẠNG THÁI (mức silo tro bay + phễu tro đáy) → snapshot/restore cho OTS.
//
// Neo Design Basis (Phụ lục A): than bituminous tro 15%. Phân bổ đáy/bay, sức chứa silo, ngưỡng xả xe
// bồn = [GIẢ ĐỊNH] GĐ-91.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const ASH_FRAC = 0.15; // tỷ lệ tro trong than (Design Basis)
const BOTTOM_FRAC = 0.2; // tro đáy / tổng tro
const FLY_FRAC = 0.8; // tro bay / tổng tro
const SILO_CAP_T = 600; // sức chứa silo tro bay (~ vài giờ ở tải danh định)
const SILO_HI_PCT = 90; // > ngưỡng → xả xe bồn
const SILO_LO_PCT = 40; // < ngưỡng → dừng xả (trễ)
const UNLOAD_RATE_TPH = 60; // suất xả xe bồn tro bay
const BA_HOPPER_CAP_T = 120; // sức chứa phễu tro đáy (xả chu kỳ)

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class AshHandlingModel implements ISimModel {
  readonly id = 'thermal-ash-handling';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'ASH_TOTAL_01', // t/h — tổng sản lượng tro
    'ASH_BOTTOM_FLOW_01', // t/h — tro đáy
    'ASH_FLY_FLOW_01', // t/h — tro bay (từ ESP)
    'ASH_SILO_LEVEL_01', // % — mức silo tro bay
    'ASH_BA_HOPPER_LEVEL_01', // % — mức phễu tro đáy (SSC)
    'ASH_UNLOAD_RATE_01', // t/h — suất xả xe bồn tro bay
    'ASH_ESP_HOP_A_01', // % — mức phễu ESP trường A (đầu, thu nhiều)
    'ASH_ESP_HOP_B_01', // % — mức phễu ESP trường B
    'ASH_ESP_HOP_C_01', // % — mức phễu ESP trường C (cuối, thu ít)
  ];

  private siloLevel = 55; // %
  private baHopper = 30; // %
  private unloading = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.siloLevel = 55;
    this.baHopper = 30;
    this.unloading = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dtH = ctx.dtMs / 3_600_000; // giờ
    const coal = Math.max(0, ctx.getTag('BLR_COAL_FLOW_01'));
    const ashTotal = coal * ASH_FRAC;
    const bottom = ashTotal * BOTTOM_FRAC;
    const fly = ashTotal * FLY_FRAC;

    // Silo tro bay: nạp từ ESP, xả xe bồn theo trễ (hysteresis) giữ mức trong dải.
    if (this.siloLevel > SILO_HI_PCT) this.unloading = true;
    else if (this.siloLevel < SILO_LO_PCT) this.unloading = false;
    const unload = this.unloading ? UNLOAD_RATE_TPH : 0;
    this.siloLevel = clamp(this.siloLevel + ((fly - unload) / SILO_CAP_T) * 100 * dtH, 0, 100);

    // Phễu tro đáy: tích luỹ tro đáy, xả chu kỳ khi đầy (SSC nhấn chìm nước) — mô hình răng cưa đơn giản.
    this.baHopper = this.baHopper + (bottom / BA_HOPPER_CAP_T) * 100 * dtH;
    if (this.baHopper > 100) this.baHopper = 15; // xả phễu (clinker grinder → băng cào)

    // Phễu ESP theo trường: trường đầu thu nhiều tro nhất, giảm dần về cuối (phân bố thu bụi thực).
    const espBase = clamp(35 + this.siloLevel * 0.2, 0, 95);

    return {
      outputs: [
        { tagId: 'ASH_TOTAL_01', value: ashTotal, quality: 'Good' },
        { tagId: 'ASH_BOTTOM_FLOW_01', value: bottom, quality: 'Good' },
        { tagId: 'ASH_FLY_FLOW_01', value: fly, quality: 'Good' },
        { tagId: 'ASH_SILO_LEVEL_01', value: this.siloLevel, quality: 'Good' },
        { tagId: 'ASH_BA_HOPPER_LEVEL_01', value: this.baHopper, quality: 'Good' },
        { tagId: 'ASH_UNLOAD_RATE_01', value: unload, quality: 'Good' },
        { tagId: 'ASH_ESP_HOP_A_01', value: clamp(espBase + 20, 0, 98), quality: 'Good' },
        { tagId: 'ASH_ESP_HOP_B_01', value: espBase, quality: 'Good' },
        { tagId: 'ASH_ESP_HOP_C_01', value: clamp(espBase - 18, 0, 98), quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { siloLevel: this.siloLevel, baHopper: this.baHopper, unloading: this.unloading ? 1 : 0 } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.siloLevel = snapshot.state.siloLevel ?? 55;
    this.baHopper = snapshot.state.baHopper ?? 30;
    this.unloading = (snapshot.state.unloading ?? 0) > 0.5;
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

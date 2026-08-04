// Plugin thermal-power-600 — FireFightingModel (ISimModel, doc 10 §10 BOP — Hệ chữa cháy).
// CHỈ import @idtp/sdk. Hệ chữa cháy nước: vòng ống chính (fire ring main) giữ áp bằng bơm bù (jockey);
// khi áp tụt (có nhu cầu chữa cháy) → bơm chính (điện) khởi động, dự phòng bơm diesel. Bồn nước chữa cháy
// + bình bọt (foam) cho máy biến áp/dầu. Ở trạng thái thường: jockey giữ áp, không báo cháy.
//
// ADDITIVE — sinh tag FIRE_* độc lập. Tất định (không Math.random). Có TRẠNG THÁI (áp vòng ống · mức bồn ·
// latch bơm) → snapshot/restore. Malfunction 'fire-detected' → báo cháy + bơm chính chạy + rút nước bồn (OTS).
// Áp vòng ống, dung tích bồn, ngưỡng khởi bơm = [GIẢ ĐỊNH] GĐ-103.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const RING_NOM_BARG = 9; // barg — áp vòng ống chính danh định (jockey giữ)
const RING_PUMP_START_BARG = 7; // barg — áp tụt dưới ngưỡng → bơm chính khởi động
const MAIN_PUMP_FLOW_TPH = 400; // t/h — suất bơm chính khi chữa cháy
const TANK_CAP_T = 2000; // t — dung tích bồn nước chữa cháy
const N_ZONES = 24; // tổng số vùng phát hiện cháy

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class FireFightingModel implements ISimModel {
  readonly id = 'thermal-fire-fighting';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'FIRE_RINGMAIN_PRESS_01', // barg — áp vòng ống chính
    'FIRE_JOCKEY_RUNNING_01', // 0/1 — bơm bù jockey
    'FIRE_MAIN_PUMP_RUNNING_01', // 0/1 — bơm chính (điện)
    'FIRE_DIESEL_PUMP_RUNNING_01', // 0/1 — bơm dự phòng diesel
    'FIRE_TANK_LEVEL_01', // % — mức bồn nước chữa cháy
    'FIRE_ZONES_NORMAL_01', // — số vùng phát hiện bình thường
    'FIRE_ALARM_ACTIVE_01', // 0/1 — có báo cháy
    'FIRE_FOAM_TANK_01', // % — mức bình bọt (foam) cho biến áp/dầu
  ];

  private ringPress = RING_NOM_BARG;
  private tankPct = 96;
  private fire = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.ringPress = RING_NOM_BARG;
    this.tankPct = 96;
    this.fire = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dtH = ctx.dtMs / 3_600_000; // giờ

    // Có cháy: nhu cầu nước làm áp vòng ống tụt → bơm chính khởi động bù; rút nước bồn. Không cháy: jockey
    // giữ áp danh định, bồn được bù đầy.
    if (this.fire) {
      // Áp tụt do xả nước, bơm chính bù một phần → giữ quanh ngưỡng khởi động.
      this.ringPress += (RING_PUMP_START_BARG - this.ringPress) * 0.1;
      this.tankPct = clamp(this.tankPct - (MAIN_PUMP_FLOW_TPH / TANK_CAP_T) * 100 * dtH, 0, 100);
    } else {
      this.ringPress += (RING_NOM_BARG - this.ringPress) * 0.1; // jockey giữ áp
      this.tankPct = clamp(this.tankPct + 5 * dtH, 0, 96); // bù đầy bồn
    }

    const mainPumpOn = this.fire && this.ringPress < RING_PUMP_START_BARG + 1;
    const jockeyOn = !this.fire && this.ringPress < RING_NOM_BARG - 0.3; // jockey chạy bù rò nhỏ
    const zonesNormal = this.fire ? N_ZONES - 1 : N_ZONES;

    return {
      outputs: [
        { tagId: 'FIRE_RINGMAIN_PRESS_01', value: this.ringPress, quality: 'Good' },
        { tagId: 'FIRE_JOCKEY_RUNNING_01', value: jockeyOn ? 1 : 0, quality: 'Good' },
        { tagId: 'FIRE_MAIN_PUMP_RUNNING_01', value: mainPumpOn ? 1 : 0, quality: 'Good' },
        { tagId: 'FIRE_DIESEL_PUMP_RUNNING_01', value: this.fire && this.ringPress < RING_PUMP_START_BARG - 1 ? 1 : 0, quality: 'Good' },
        { tagId: 'FIRE_TANK_LEVEL_01', value: this.tankPct, quality: 'Good' },
        { tagId: 'FIRE_ZONES_NORMAL_01', value: zonesNormal, quality: 'Good' },
        { tagId: 'FIRE_ALARM_ACTIVE_01', value: this.fire ? 1 : 0, quality: 'Good' },
        { tagId: 'FIRE_FOAM_TANK_01', value: 88, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { ringPress: this.ringPress, tankPct: this.tankPct, fire: this.fire ? 1 : 0 } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.ringPress = snapshot.state.ringPress ?? RING_NOM_BARG;
    this.tankPct = snapshot.state.tankPct ?? 96;
    this.fire = (snapshot.state.fire ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    // Phát hiện cháy: báo động + bơm chính chạy + rút nước bồn (OTS).
    if (m.id === 'fire-detected') this.fire = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'fire-detected') this.fire = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

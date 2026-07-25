// Plugin thermal-power-600 — DrumModel (ISimModel, doc 10 §2-3). CHỈ import @idtp/sdk (L-P1).
// Cân bằng khối lượng + swell/shrink (đảo pha ngắn hạn khi mất cân bằng flow).
import type {
  ISimModel,
  ISimModelContext,
  ISimStepResult,
  ISimSnapshot,
  IMalfunction,
  TagId,
} from '@idtp/sdk';

// Hằng số [GIẢ ĐỊNH] (doc 25 GĐ-20) — hiệu chỉnh khi tuning trên sim thực.
const FW_MAX_TPH = 2100; // công suất feedwater (~ BMCR 2008 t/h + dự trữ)
const K_AREA = 30; // mm mức / (t nước tích luỹ)
const K_SWELL = 0.8; // mm swell / (t/h chênh lệch flow)

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class DrumModel implements ISimModel {
  readonly id = 'thermal-boiler-island';
  readonly tagsProvided: ReadonlyArray<TagId> = ['BLR_DRUM_LEVEL_01', 'BLR_STEAM_FLOW_01', 'BLR_FW_FLOW_01'];

  private massLevel = 0; // mm — thành phần khối lượng nước
  private leak = 0; // t/h — tube leak (malfunction)

  init(): void {
    this.massLevel = 0;
    this.leak = 0;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const fwCv = clamp(ctx.getTag('BLR_FW_CV_01'), 0, 100); // % mở van nước cấp
    const steam = Math.max(0, ctx.getTag('BLR_STEAM_DEMAND')); // t/h (tải)
    const fw = (fwCv / 100) * FW_MAX_TPH - this.leak; // t/h feedwater thực
    const dtH = ctx.dtMs / 3_600_000;

    this.massLevel += (fw - steam) * dtH * K_AREA;
    // swell/shrink: khi steam > fw (tải tăng), bọt hơi nở → mức DÂNG thoáng qua dù mass giảm
    const level = this.massLevel + K_SWELL * (steam - fw);

    return {
      outputs: [
        { tagId: 'BLR_DRUM_LEVEL_01', value: level, quality: 'Good' },
        { tagId: 'BLR_STEAM_FLOW_01', value: steam, quality: 'Good' },
        { tagId: 'BLR_FW_FLOW_01', value: fw, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { massLevel: this.massLevel, leak: this.leak } };
  }

  restore(snapshot: ISimSnapshot): void {
    this.massLevel = snapshot.state.massLevel ?? 0;
    this.leak = snapshot.state.leak ?? 0;
  }

  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'tube-leak') this.leak = m.params?.rate ?? 50;
  }

  clearMalfunction(id: string): void {
    if (id === 'tube-leak') this.leak = 0;
  }

  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

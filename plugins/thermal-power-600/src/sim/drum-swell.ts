// Plugin thermal-power-600 — DrumSwellModel (ISimModel, doc 10 §6 — động học 2 pha bao hơi: shrink/swell).
// CHỈ import @idtp/sdk. CHIỀU SÂU: hiệu ứng NON-MINIMUM-PHASE của mức bao hơi. Khi TĂNG tải (lưu lượng hơi ↑),
// áp bao hơi tụt tức thời → bọt hơi trong ống nước NỞ → mức DÂNG (swell) DÙ khối lượng nước đang GIẢM; khi
// GIẢM tải → mức TỤT (shrink) dù khối lượng tăng. Đây là lý do loop mức 3-phần-tử (3-element) dùng cả lưu
// lượng hơi + nước cấp. Đọc BLR_STEAM_FLOW_01 (đạo hàm → tốc độ đổi tải) + BLR_DRUM_LEVEL_01 → thành phần
// swell/shrink + mức biểu kiến vs mức "thật" (theo khối lượng) ước lượng.
//
// ADDITIVE — sinh tag DRM_* ĐỘC LẬP; KHÔNG đổi BLR_DRUM_LEVEL_01 lõi (0 hồi quy). Swell là thành phần CHẨN
// ĐOÁN tách ra, không ghi mức lõi. Tất định (không Math.random). Có TRẠNG THÁI (lưu lượng hơi trước, swell,
// đỉnh) → snapshot/restore. Malfunction: 'rapid-loadup' (ép sự kiện tăng tải nhanh → swell dương) ·
// 'rapid-loaddown' (giảm tải nhanh → shrink âm) — minh hoạ trên HMI không cần đổi tải thật.
//
// Neo Design Basis (Phụ lục A §2): bao hơi drum-type ~1500 t/h ở đầy tải. Hệ số swell theo tốc độ đổi tải,
// hằng thời gian phân rã swell, biên độ sự kiện = [GIẢ ĐỊNH].
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const K_SWELL_MM_PER_TPH_MIN = 0.16; // mm mức / (t/h·phút) tốc độ đổi hơi — độ lớn swell/shrink
const TAU_SWELL_S = 12; // s — hằng thời gian phân rã swell (bọt hơi ổn định lại)
const TAU_RATE_S = 6; // s — lọc tốc độ đổi lưu lượng hơi (bớt nhiễu số)
const SWELL_HEALTHY_MM = 40; // mm — |swell| trong ngưỡng bình thường
const EVENT_RATE_TPH_MIN = 90; // t/h/phút — biên tốc độ đổi tải "nhanh" khi ép sự kiện malfunction
const TAU_EVENT_S = 25; // s — thời lượng phân rã xung sự kiện ép về 0 (đổi tải là quá độ)

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class DrumSwellModel implements ISimModel {
  readonly id = 'thermal-drum-swell';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'DRM_STEAM_RATE_01', // t/h/phút — tốc độ đổi lưu lượng hơi (lọc)
    'DRM_SWELL_MM_01', // mm — thành phần swell(+)/shrink(−) của mức
    'DRM_APPARENT_LEVEL_01', // mm — mức biểu kiến (đo được = lõi)
    'DRM_TRUE_LEVEL_EST_01', // mm — mức "thật" theo khối lượng (biểu kiến − swell)
    'DRM_SWELL_ACTIVE_01', // 0/1 — đang có swell/shrink đáng kể
    'DRM_SWELL_PEAK_01', // mm — |swell| đỉnh phiên
    'DRM_HEALTHY_01', // 0/1 — mức ổn định, swell trong ngưỡng
  ];

  private prevSteam: number | null = null;
  private filtRate = 0; // t/h/phút — tốc độ đổi hơi đã lọc
  private swell = 0; // mm
  private peak = 0; // mm
  private eventRate = 0; // t/h/phút — xung tốc độ ép bởi malfunction (phân rã về 0)

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.prevSteam = null;
    this.filtRate = 0;
    this.swell = 0;
    this.peak = 0;
    this.eventRate = 0;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dt = ctx.dtMs / 1000;
    const steam = Math.max(0, ctx.getTag('BLR_STEAM_FLOW_01'));
    const apparent = ctx.getTag('BLR_DRUM_LEVEL_01'); // mm quanh setpoint (có thể âm)

    // Tốc độ đổi lưu lượng hơi THẬT (t/h mỗi phút), lọc bậc 1 cho bớt nhiễu số.
    const rawRate = this.prevSteam === null ? 0 : ((steam - this.prevSteam) / dt) * 60; // t/h/phút
    this.prevSteam = steam;
    this.filtRate += (rawRate - this.filtRate) * (dt / TAU_RATE_S);

    // Xung sự kiện ép (malfunction) phân rã dần về 0 (đổi tải nhanh là quá độ, không duy trì).
    this.eventRate += (0 - this.eventRate) * (dt / TAU_EVENT_S);
    const effectiveRate = this.filtRate + this.eventRate;

    // Swell đuổi mục tiêu ∝ tốc độ đổi tải, rồi PHÂN RÃ (bọt ổn định) → hiệu ứng non-minimum-phase thoáng qua.
    const swellTarget = K_SWELL_MM_PER_TPH_MIN * effectiveRate;
    this.swell += (swellTarget - this.swell) * (dt / TAU_SWELL_S);
    this.peak = Math.max(this.peak, Math.abs(this.swell));

    const trueLevel = apparent - this.swell; // mức theo khối lượng = biểu kiến trừ swell
    const active = Math.abs(this.swell) > 3 ? 1 : 0;
    const healthy = Math.abs(this.swell) <= SWELL_HEALTHY_MM ? 1 : 0;

    return {
      outputs: [
        { tagId: 'DRM_STEAM_RATE_01', value: effectiveRate, quality: 'Good' },
        { tagId: 'DRM_SWELL_MM_01', value: this.swell, quality: 'Good' },
        { tagId: 'DRM_APPARENT_LEVEL_01', value: apparent, quality: 'Good' },
        { tagId: 'DRM_TRUE_LEVEL_EST_01', value: trueLevel, quality: 'Good' },
        { tagId: 'DRM_SWELL_ACTIVE_01', value: active, quality: 'Good' },
        { tagId: 'DRM_SWELL_PEAK_01', value: this.peak, quality: 'Good' },
        { tagId: 'DRM_HEALTHY_01', value: healthy, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return {
      state: {
        prevSteam: this.prevSteam ?? -1,
        filtRate: this.filtRate,
        swell: this.swell,
        peak: this.peak,
        eventRate: this.eventRate,
      },
    };
  }
  restore(snapshot: ISimSnapshot): void {
    const ps = snapshot.state.prevSteam ?? -1;
    this.prevSteam = ps >= 0 ? ps : null;
    this.filtRate = snapshot.state.filtRate ?? 0;
    this.swell = snapshot.state.swell ?? 0;
    this.peak = snapshot.state.peak ?? 0;
    this.eventRate = snapshot.state.eventRate ?? 0;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'rapid-loadup') this.eventRate = EVENT_RATE_TPH_MIN; // xung tăng tải → swell dương
    if (m.id === 'rapid-loaddown') this.eventRate = -EVENT_RATE_TPH_MIN; // xung giảm tải → shrink âm
  }
  clearMalfunction(id: string): void {
    if (id === 'rapid-loadup' || id === 'rapid-loaddown') this.eventRate = 0;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

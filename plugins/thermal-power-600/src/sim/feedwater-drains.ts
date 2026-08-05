// Plugin thermal-power-600 — FeedwaterDrainsModel (ISimModel, doc 10 §6 — DRAIN CASCADE bình gia nhiệt).
// CHỈ import @idtp/sdk. CHIỀU SÂU vật lý phía VỎ bình gia nhiệt hồi nhiệt: hơi trích ngưng trong mỗi bình
// → nước ngưng (drain) CASCADE từ bình áp cao xuống bình áp thấp hơn (HP3→HP2→HP1→deaerator; LP4→LP3→
// LP2→LP1→bình ngưng). Mỗi bình có: chênh nhiệt đầu cuối TTD (Tsat_vỏ − T_nước-cấp-ra) · độ tiệm cận bộ
// làm nguội drain DCA (T_drain-ra − T_nước-cấp-vào) · mức drain (điều khiển bằng van drain thường; cao thì
// van XẢ KHẨN xuống bình ngưng). Đọc nhiệt đầu ra từng bình (FeedwaterTrainModel đã có) → sinh tag drain.
//
// ADDITIVE — sinh tag FWH_* độc lập; KHÔNG đổi tag FW_*/nhiệt bình (0 hồi quy). Tất định (không Math.random).
// Có TRẠNG THÁI (mức drain HP/LP + latch xả khẩn) → snapshot/restore. Malfunction 'heater-drain-high'
// (mức drain HP dâng → van xả khẩn mở → drain đổ thẳng bình ngưng, mất hồi nhiệt — OTS).
//
// Neo Design Basis (Phụ lục A): 3 HP + 4 LP heater, drain cascade. TTD, DCA, mức drain danh định, tỉ lệ
// lưu lượng drain, ngưỡng xả khẩn = [GIẢ ĐỊNH] GĐ-107 — số heat-balance/GA bình gia nhiệt thật thay khi có.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const TTD_NOM_C = 3; // °C — chênh nhiệt đầu cuối danh định (Tsat vỏ − nước cấp ra)
const DCA_NOM_C = 5.5; // °C — độ tiệm cận bộ làm nguội drain (drain ra − nước cấp vào)
const DRAIN_LEVEL_SP = 50; // % — mức drain điều khiển bình thường
const EMERG_OPEN_PCT = 80; // % — mức cao → mở van xả khẩn xuống bình ngưng
const EMERG_CLOSE_PCT = 60; // % — mức hạ → đóng van xả khẩn (trễ)
const DRAIN_RISE_PCT_PER_H = 240; // %/h — tốc độ dâng mức khi sự cố drain (van thường không thoát kịp)
const DRAIN_DUMP_PCT_PER_H = 360; // %/h — tốc độ hạ mức khi xả khẩn
const DRAIN_CASCADE_FRAC = 0.09; // lưu lượng drain string LP xuống bình ngưng ≈ 9% lưu lượng hơi
const EMERG_DRAIN_TPH = 120; // t/h — lưu lượng qua van xả khẩn khi mở

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class FeedwaterDrainsModel implements ISimModel {
  readonly id = 'thermal-feedwater-drains';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'FWH_HPH3_DRAIN_TEMP_01', // °C — drain bình HP3 (áp cao nhất, cascade xuống HP2)
    'FWH_HPH2_DRAIN_TEMP_01', // °C — drain bình HP2
    'FWH_HPH1_DRAIN_TEMP_01', // °C — drain bình HP1 (cascade vào deaerator)
    'FWH_LPH4_DRAIN_TEMP_01', // °C — drain bình LP4
    'FWH_LPH1_DRAIN_TEMP_01', // °C — drain bình LP1 (cascade vào bình ngưng)
    'FWH_HPH_TTD_01', // °C — chênh nhiệt đầu cuối đại diện đoàn HP
    'FWH_LPH_TTD_01', // °C — chênh nhiệt đầu cuối đại diện đoàn LP
    'FWH_HPH_DCA_01', // °C — độ tiệm cận bộ làm nguội drain HP
    'FWH_HPH_DRAIN_LEVEL_01', // % — mức drain đoàn HP
    'FWH_LPH_DRAIN_LEVEL_01', // % — mức drain đoàn LP
    'FWH_EMERG_DRAIN_01', // 0/1 — van xả khẩn (dump→bình ngưng) đang mở
    'FWH_DRAIN_TO_COND_01', // t/h — lưu lượng drain cascade về bình ngưng
  ];

  private hpDrainLevel = DRAIN_LEVEL_SP;
  private lpDrainLevel = DRAIN_LEVEL_SP;
  private emergOpen = false;
  private drainHigh = false; // malfunction latch

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.hpDrainLevel = DRAIN_LEVEL_SP;
    this.lpDrainLevel = DRAIN_LEVEL_SP;
    this.emergOpen = false;
    this.drainHigh = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dtH = ctx.dtMs / 3_600_000;
    const steam = Math.max(0, ctx.getTag('BLR_STEAM_FLOW_01'));
    const loadFrac = clamp(steam / 2008, 0, 1.1);
    // Nhiệt nước cấp các nút (FeedwaterTrainModel đã có) — drain ra ≈ nước cấp VÀO bình + DCA.
    const tCond = ctx.getTag('FW_CONDENSATE_TEMP_01');
    const tDea = ctx.getTag('FW_DEAERATOR_TEMP_01');
    const tHph1 = ctx.getTag('FW_HPH1_TEMP_01');
    const tHph2 = ctx.getTag('FW_HPH2_TEMP_01');
    const tLph3 = ctx.getTag('FW_LPH3_TEMP_01');

    // Drain mỗi bình: nước ngưng được làm nguội tới ~ nhiệt nước cấp VÀO bình đó + DCA.
    const hph3Drain = tHph2 + DCA_NOM_C; // HP3 vào = HP2 ra
    const hph2Drain = tHph1 + DCA_NOM_C; // HP2 vào = HP1 ra
    const hph1Drain = tDea + DCA_NOM_C; // HP1 vào = deaerator ra
    const lph4Drain = tLph3 + DCA_NOM_C; // LP4 vào = LP3 ra
    const lph1Drain = tCond + DCA_NOM_C; // LP1 vào = condensate

    // TTD tăng nhẹ ở non tải (áp trích thấp → truyền nhiệt kém hơn) — đại diện đoàn.
    const ttdHp = TTD_NOM_C + (1 - loadFrac) * 2;
    const ttdLp = TTD_NOM_C + (1 - loadFrac) * 1.5;

    // Mức drain đoàn HP: bình thường van drain thường giữ setpoint; sự cố → dâng; xả khẩn (hysteresis) hạ.
    if (this.drainHigh) {
      if (this.hpDrainLevel > EMERG_OPEN_PCT) this.emergOpen = true;
      else if (this.hpDrainLevel < EMERG_CLOSE_PCT) this.emergOpen = false;
      const rate = (this.emergOpen ? -DRAIN_DUMP_PCT_PER_H : DRAIN_RISE_PCT_PER_H) * dtH;
      this.hpDrainLevel = clamp(this.hpDrainLevel + rate, 0, 100);
    } else {
      this.emergOpen = false;
      this.hpDrainLevel += (DRAIN_LEVEL_SP - this.hpDrainLevel) * clamp(dtH * 60, 0, 1); // về setpoint
    }
    this.lpDrainLevel += (DRAIN_LEVEL_SP - this.lpDrainLevel) * clamp(dtH * 60, 0, 1);

    const drainToCond = steam * DRAIN_CASCADE_FRAC + (this.emergOpen ? EMERG_DRAIN_TPH : 0);

    return {
      outputs: [
        { tagId: 'FWH_HPH3_DRAIN_TEMP_01', value: hph3Drain, quality: 'Good' },
        { tagId: 'FWH_HPH2_DRAIN_TEMP_01', value: hph2Drain, quality: 'Good' },
        { tagId: 'FWH_HPH1_DRAIN_TEMP_01', value: hph1Drain, quality: 'Good' },
        { tagId: 'FWH_LPH4_DRAIN_TEMP_01', value: lph4Drain, quality: 'Good' },
        { tagId: 'FWH_LPH1_DRAIN_TEMP_01', value: lph1Drain, quality: 'Good' },
        { tagId: 'FWH_HPH_TTD_01', value: ttdHp, quality: 'Good' },
        { tagId: 'FWH_LPH_TTD_01', value: ttdLp, quality: 'Good' },
        { tagId: 'FWH_HPH_DCA_01', value: DCA_NOM_C, quality: 'Good' },
        { tagId: 'FWH_HPH_DRAIN_LEVEL_01', value: this.hpDrainLevel, quality: 'Good' },
        { tagId: 'FWH_LPH_DRAIN_LEVEL_01', value: this.lpDrainLevel, quality: 'Good' },
        { tagId: 'FWH_EMERG_DRAIN_01', value: this.emergOpen ? 1 : 0, quality: 'Good' },
        { tagId: 'FWH_DRAIN_TO_COND_01', value: drainToCond, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { hpDrainLevel: this.hpDrainLevel, lpDrainLevel: this.lpDrainLevel, emergOpen: this.emergOpen ? 1 : 0, drainHigh: this.drainHigh ? 1 : 0 } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.hpDrainLevel = snapshot.state.hpDrainLevel ?? DRAIN_LEVEL_SP;
    this.lpDrainLevel = snapshot.state.lpDrainLevel ?? DRAIN_LEVEL_SP;
    this.emergOpen = (snapshot.state.emergOpen ?? 0) > 0.5;
    this.drainHigh = (snapshot.state.drainHigh ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    // Mức drain HP dâng cao (van drain thường kẹt/thoát kém) → van xả khẩn mở đổ về bình ngưng (mất hồi nhiệt).
    if (m.id === 'heater-drain-high') this.drainHigh = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'heater-drain-high') this.drainHigh = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

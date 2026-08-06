// Plugin thermal-power-600 — HeaterDetailModel (ISimModel, doc 10 §6 — bình gia nhiệt PER-HEATER, chiều sâu).
// CHỈ import @idtp/sdk. CHIỀU SÂU: phân giải TỪNG bình gia nhiệt HP1–HP3 + LP1–LP4 (mỗi bình: mức nước ngưng
// tụ · TTD · van xả drain). Khác feedwater-drains (GĐ-107, TỔNG HP/LP) ở granularity per-heater + động học
// van drain kẹt. Van drain kẹt ĐÓNG → mức bình dâng → ngập ống → TTD xấu (kém hồi nhiệt) → nhiệt nước cấp tụt.
// Đọc GEN_MW_01 (tải → áp trích hơi) làm neo; sinh tag HTR_* per-heater.
//
// ADDITIVE — sinh tag HTR_* ĐỘC LẬP; KHÔNG đổi FWH_*/tag nước cấp lõi (0 hồi quy). Ước lượng nhiệt nước cấp là
// CHẨN ĐOÁN, không ghi tag lõi. Tất định (không Math.random). Có TRẠNG THÁI (van drain kẹt) → snapshot/restore.
// Malfunction: 'hp2-drain-stuck' · 'lp3-drain-stuck' (van drain kẹt đóng → mức dâng → TTD xấu bình đó).
//
// Neo Design Basis (Phụ lục A §3.2): đoàn gia nhiệt 3 HP + 4 LP (deaerator riêng). TTD định mức ~3°C, mức
// bình ~50%. Áp trích hơi từng tầng, hệ số TTD theo mức ngập, tương quan nhiệt nước cấp = [GIẢ ĐỊNH].
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const HEATERS = ['HP1', 'HP2', 'HP3', 'LP1', 'LP2', 'LP3', 'LP4'] as const;
type HeaterId = (typeof HEATERS)[number];
const TTD_NOM_C = 3; // °C — TTD định mức (nhiệt bão hoà − nhiệt nước ra)
const LEVEL_NOM_PCT = 50; // % — mức nước ngưng tụ định mức
const LEVEL_STUCK_PCT = 92; // % — mức khi van drain kẹt đóng (ngập ống)
const K_TTD_FLOOD = 0.25; // °C TTD tăng / %mức vượt định mức (ngập → kém trao đổi nhiệt)
const TTD_HEALTHY_MAX = 6; // °C — TTD tối đa lành mạnh
const TAU_LEVEL_S = 40; // s — quán tính mức bình khi van drain đổi trạng thái

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class HeaterDetailModel implements ISimModel {
  readonly id = 'thermal-heater-detail';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'HTR_HP1_LEVEL_01', 'HTR_HP1_TTD_01', 'HTR_HP1_DRAIN_01',
    'HTR_HP2_LEVEL_01', 'HTR_HP2_TTD_01', 'HTR_HP2_DRAIN_01',
    'HTR_HP3_LEVEL_01', 'HTR_HP3_TTD_01', 'HTR_HP3_DRAIN_01',
    'HTR_LP1_LEVEL_01', 'HTR_LP1_TTD_01', 'HTR_LP1_DRAIN_01',
    'HTR_LP2_LEVEL_01', 'HTR_LP2_TTD_01', 'HTR_LP2_DRAIN_01',
    'HTR_LP3_LEVEL_01', 'HTR_LP3_TTD_01', 'HTR_LP3_DRAIN_01',
    'HTR_LP4_LEVEL_01', 'HTR_LP4_TTD_01', 'HTR_LP4_DRAIN_01',
    'HTR_WORST_TTD_01', // °C — TTD xấu nhất toàn đoàn
    'HTR_MAX_LEVEL_01', // % — mức cao nhất toàn đoàn
    'HTR_STUCK_COUNT_01', // — số bình van drain kẹt
    'HTR_FW_TEMP_PENALTY_01', // °C — hụt nhiệt nước cấp ước lượng do TTD xấu
    'HTR_HEALTHY_01', // 0/1 — mọi bình bình thường
  ];

  private stuck = new Set<HeaterId>();
  private level: Record<HeaterId, number> = { HP1: LEVEL_NOM_PCT, HP2: LEVEL_NOM_PCT, HP3: LEVEL_NOM_PCT, LP1: LEVEL_NOM_PCT, LP2: LEVEL_NOM_PCT, LP3: LEVEL_NOM_PCT, LP4: LEVEL_NOM_PCT };

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.stuck = new Set<HeaterId>();
    for (const h of HEATERS) this.level[h] = LEVEL_NOM_PCT;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dt = ctx.dtMs / 1000;
    const loadFrac = clamp(Math.max(0, ctx.getTag('GEN_MW_01')) / 600, 0, 1.1);

    const outputs: Array<{ tagId: TagId; value: number; quality: 'Good' }> = [];
    let worstTtd = 0;
    let maxLevel = 0;
    let ttdSum = 0;
    for (const h of HEATERS) {
      const target = this.stuck.has(h) ? LEVEL_STUCK_PCT : LEVEL_NOM_PCT;
      this.level[h] += (target - this.level[h]) * (dt / TAU_LEVEL_S);
      const lvl = this.level[h];
      // TTD định mức + xấu đi khi ngập (mức vượt định mức); tải thấp TTD nhỉnh nhẹ.
      const ttd = TTD_NOM_C + K_TTD_FLOOD * Math.max(0, lvl - LEVEL_NOM_PCT) + (1 - loadFrac) * 0.5;
      const drainValve = this.stuck.has(h) ? 0 : clamp(30 + loadFrac * 50, 0, 100); // kẹt → 0%
      outputs.push({ tagId: `HTR_${h}_LEVEL_01` as TagId, value: lvl, quality: 'Good' });
      outputs.push({ tagId: `HTR_${h}_TTD_01` as TagId, value: ttd, quality: 'Good' });
      outputs.push({ tagId: `HTR_${h}_DRAIN_01` as TagId, value: drainValve, quality: 'Good' });
      worstTtd = Math.max(worstTtd, ttd);
      maxLevel = Math.max(maxLevel, lvl);
      ttdSum += ttd;
    }
    // Hụt nhiệt nước cấp ước lượng ∝ tổng TTD vượt định mức (mỗi °C TTD ~ 0,4°C hụt nước cấp).
    const fwPenalty = Math.max(0, ttdSum - HEATERS.length * TTD_NOM_C) * 0.4;
    const stuckCount = this.stuck.size;
    const healthy = worstTtd <= TTD_HEALTHY_MAX && stuckCount === 0 ? 1 : 0;

    outputs.push(
      { tagId: 'HTR_WORST_TTD_01', value: worstTtd, quality: 'Good' },
      { tagId: 'HTR_MAX_LEVEL_01', value: maxLevel, quality: 'Good' },
      { tagId: 'HTR_STUCK_COUNT_01', value: stuckCount, quality: 'Good' },
      { tagId: 'HTR_FW_TEMP_PENALTY_01', value: fwPenalty, quality: 'Good' },
      { tagId: 'HTR_HEALTHY_01', value: healthy, quality: 'Good' },
    );
    return { outputs };
  }

  snapshot(): ISimSnapshot {
    const state: Record<string, number> = {};
    for (const h of HEATERS) {
      state[`lvl_${h}`] = this.level[h];
      state[`stuck_${h}`] = this.stuck.has(h) ? 1 : 0;
    }
    return { state };
  }
  restore(snapshot: ISimSnapshot): void {
    this.stuck = new Set<HeaterId>();
    for (const h of HEATERS) {
      this.level[h] = snapshot.state[`lvl_${h}`] ?? LEVEL_NOM_PCT;
      if ((snapshot.state[`stuck_${h}`] ?? 0) > 0.5) this.stuck.add(h);
    }
  }
  injectMalfunction(m: IMalfunction): void {
    const id = /^(hp[1-3]|lp[1-4])-drain-stuck$/.exec(m.id)?.[1];
    if (id) this.stuck.add(id.toUpperCase() as HeaterId);
  }
  clearMalfunction(id: string): void {
    const h = /^(hp[1-3]|lp[1-4])-drain-stuck$/.exec(id)?.[1];
    if (h) this.stuck.delete(h.toUpperCase() as HeaterId);
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

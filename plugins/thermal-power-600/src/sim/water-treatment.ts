// Plugin thermal-power-600 — WaterTreatmentModel (ISimModel, doc 10 §10 BOP — Xử lý nước khử khoáng DM).
// CHỈ import @idtp/sdk. Hệ Balance-of-Plant §10: nhà máy khử khoáng (demineralization) cấp nước bù chu
// trình hơi-nước (bù tổn thất xả lò · hơi thổi bụi không hồi · rò hơi chèn · lấy mẫu). Dây chuyền: cation
// → khử khí (degasser) → anion → hỗn hợp (mixed bed) → bồn nước DM → bơm bù. Nhựa trao đổi ion tích tải
// theo lưu lượng; tới ngưỡng thì ĐỘ DẪN đầu ra tăng vọt (breakthrough) → dây chuyền tái sinh (acid/kiềm).
//
// ADDITIVE — sinh tag WT_* độc lập; đọc BLR_STEAM_FLOW_01 (+ SB_STEAM_FLOW_01 nếu có) suy nhu cầu bù. Tất
// định (không Math.random). Có TRẠNG THÁI (mức bồn DM · tải nhựa · tiến trình tái sinh) → snapshot/restore.
//
// Neo Design Basis (Phụ lục A): chu trình drum-type có xả lò + tổn thất. Tỷ lệ bù, sức chứa bồn, ngưỡng
// breakthrough, thời gian tái sinh, độ dẫn sản phẩm = [GIẢ ĐỊNH] GĐ-99.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const MAKEUP_FRAC = 0.012; // nhu cầu bù ≈ 1,2% lưu lượng hơi (xả lò + rò + lấy mẫu)
const DM_TANK_CAP_T = 500; // sức chứa bồn nước DM
const TANK_LO_PCT = 45; // < ngưỡng → dây chuyền sản xuất
const TANK_HI_PCT = 92; // > ngưỡng → dừng sản xuất (trễ chống dao động)
const PROD_RATE_TPH = 45; // suất sản xuất DM khi chạy
const RESIN_CAP_T = 900; // thông lượng nhựa trước khi cạn (t nước qua 1 chu kỳ service)
const RESIN_BREAKTHROUGH_PCT = 85; // tải nhựa > ngưỡng → độ dẫn/silica tăng vọt (rò ion)
const REGEN_MIN = 90; // thời gian tái sinh 1 dây chuyền (acid + kiềm + rửa)
const N_TRAINS = 3; // 2 service + 1 dự phòng/tái sinh
const COND_CLEAN_US = 0.08; // µS/cm — độ dẫn sản phẩm mixed-bed khi nhựa còn tốt
const COND_BREAKTHROUGH_US = 0.6; // µS/cm — độ dẫn khi nhựa cạn (rò)
const SILICA_CLEAN_PPB = 5; // ppb — silica nước DM khi tốt
const SILICA_BREAKTHROUGH_PPB = 25; // ppb — silica khi nhựa cạn

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class WaterTreatmentModel implements ISimModel {
  readonly id = 'thermal-water-treatment';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'WT_DM_TANK_LEVEL_01', // % — mức bồn nước DM
    'WT_MAKEUP_FLOW_01', // t/h — nước bù vào chu trình
    'WT_DM_PRODUCTION_01', // t/h — sản lượng nước DM
    'WT_PRODUCT_COND_01', // µS/cm — độ dẫn sản phẩm mixed-bed (chất lượng)
    'WT_SILICA_01', // ppb — silica nước DM (chất lượng)
    'WT_CATION_DP_01', // kPa — chênh áp cột cation (tăng theo bám)
    'WT_RESIN_LOADING_01', // % — tải nhựa dây chuyền service (0 mới → 100 cạn)
    'WT_REGEN_ACTIVE_01', // 0/1 — có dây chuyền đang tái sinh
    'WT_TRAINS_INSERVICE_01', // — số dây chuyền đang service
  ];

  private tankLevel = 70; // %
  private resinLoading = 20; // %
  private regenActive = false;
  private regenTimerMin = 0;
  private producing = true;
  private faulted = false; // malfunction: nhựa hỏng/tái sinh kém → độ dẫn cao dù chưa cạn

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.tankLevel = 70;
    this.resinLoading = 20;
    this.regenActive = false;
    this.regenTimerMin = 0;
    this.producing = true;
    this.faulted = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dtH = ctx.dtMs / 3_600_000; // giờ
    const dtMin = ctx.dtMs / 60_000; // phút
    const steam = Math.max(0, ctx.getTag('BLR_STEAM_FLOW_01'));
    const sootSteam = Math.max(0, ctx.getTag('SB_STEAM_FLOW_01')); // hơi thổi bụi không hồi (nếu model có)
    const makeup = steam * MAKEUP_FRAC + sootSteam; // t/h nước bù

    // Sản xuất DM theo trễ (hysteresis) giữ mức bồn trong dải.
    if (this.tankLevel < TANK_LO_PCT) this.producing = true;
    else if (this.tankLevel > TANK_HI_PCT) this.producing = false;
    const production = this.producing ? PROD_RATE_TPH : 0;
    this.tankLevel = clamp(this.tankLevel + ((production - makeup) / DM_TANK_CAP_T) * 100 * dtH, 0, 100);

    // Tải nhựa tích theo thông lượng sản xuất; cạn → tái sinh (offline một dây chuyền), rồi nạp lại.
    if (this.regenActive) {
      this.regenTimerMin += dtMin;
      if (this.regenTimerMin >= REGEN_MIN) {
        this.regenActive = false;
        this.regenTimerMin = 0;
        this.resinLoading = 5; // nhựa vừa tái sinh
      }
    } else {
      this.resinLoading = clamp(this.resinLoading + (production / RESIN_CAP_T) * 100 * dtH, 0, 100);
      if (this.resinLoading >= 100) {
        this.regenActive = true;
        this.regenTimerMin = 0;
      }
    }

    // Chất lượng: độ dẫn & silica thấp tới khi tải nhựa vượt breakthrough thì tăng dần (rò ion). Lỗi nhựa
    // (malfunction) ép luôn về mức rò.
    const overBt = this.faulted ? 1 : clamp((this.resinLoading - RESIN_BREAKTHROUGH_PCT) / (100 - RESIN_BREAKTHROUGH_PCT), 0, 1);
    const cond = COND_CLEAN_US + (COND_BREAKTHROUGH_US - COND_CLEAN_US) * overBt;
    const silica = SILICA_CLEAN_PPB + (SILICA_BREAKTHROUGH_PPB - SILICA_CLEAN_PPB) * overBt;
    const cationDp = 30 + this.resinLoading * 0.5; // kPa — chênh áp tăng theo bám
    const trainsInService = N_TRAINS - (this.regenActive ? 1 : 0);

    return {
      outputs: [
        { tagId: 'WT_DM_TANK_LEVEL_01', value: this.tankLevel, quality: 'Good' },
        { tagId: 'WT_MAKEUP_FLOW_01', value: makeup, quality: 'Good' },
        { tagId: 'WT_DM_PRODUCTION_01', value: production, quality: 'Good' },
        { tagId: 'WT_PRODUCT_COND_01', value: cond, quality: 'Good' },
        { tagId: 'WT_SILICA_01', value: silica, quality: 'Good' },
        { tagId: 'WT_CATION_DP_01', value: cationDp, quality: 'Good' },
        { tagId: 'WT_RESIN_LOADING_01', value: this.resinLoading, quality: 'Good' },
        { tagId: 'WT_REGEN_ACTIVE_01', value: this.regenActive ? 1 : 0, quality: 'Good' },
        { tagId: 'WT_TRAINS_INSERVICE_01', value: trainsInService, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return {
      state: {
        tankLevel: this.tankLevel,
        resinLoading: this.resinLoading,
        regenActive: this.regenActive ? 1 : 0,
        regenTimerMin: this.regenTimerMin,
        producing: this.producing ? 1 : 0,
        faulted: this.faulted ? 1 : 0,
      },
    };
  }
  restore(snapshot: ISimSnapshot): void {
    this.tankLevel = snapshot.state.tankLevel ?? 70;
    this.resinLoading = snapshot.state.resinLoading ?? 20;
    this.regenActive = (snapshot.state.regenActive ?? 0) > 0.5;
    this.regenTimerMin = snapshot.state.regenTimerMin ?? 0;
    this.producing = (snapshot.state.producing ?? 1) > 0.5;
    this.faulted = (snapshot.state.faulted ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    // Nhựa hỏng / tái sinh kém: độ dẫn & silica cao dù chưa cạn → nguy cơ nhiễm bẩn chu trình (OTS).
    if (m.id === 'dm-resin-fault') this.faulted = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'dm-resin-fault') this.faulted = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}

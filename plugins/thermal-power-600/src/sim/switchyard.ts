// Plugin thermal-power-600 — SwitchyardModel (ISimModel, doc 10 §7 BOP — Trạm phân phối 500 kV).
// CHỈ import @idtp/sdk. Phía xuất tuyến: máy phát → GSU 20/500 kV → thanh cái 500 kV (sơ đồ 1½ máy cắt)
// → 2 đường dây 500 kV ra lưới. Đọc công suất xuất lưới (sau GSU) + tốc độ trục (→ tần số) → phân bổ công
// suất/ dòng điện 2 đường dây, điện áp thanh cái, trạng thái máy cắt.
//
// ADDITIVE — sinh tag SY_* độc lập; đọc ELEC_GRID_MW_01 (xuất lưới) + TRB_SPEED_01 (tần số). Đại số thuần
// (không state ngoài latch sự cố), tất định. Malfunction 'line-trip' → 1 đường dây cắt, đường còn lại gánh
// toàn tải (dòng tăng). Ở vận hành bình thường 2 đường dây chia đều.
//
// Neo Design Basis (Phụ lục A §3.3): lưới 500 kV / 50 Hz · GSU 20/500 kV, 720 MVA · cosφ 0,9. Số đường dây,
// điện áp thanh cái danh định, hệ số công suất đường dây = [GIẢ ĐỊNH] GĐ-101.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const BUS_KV_NOM = 500; // kV — điện áp thanh cái danh định
const LINE_PF = 0.95; // hệ số công suất đường dây (tính dòng)
const SQRT3 = Math.sqrt(3);

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
// Dòng đường dây (A) từ công suất (MW) ở điện áp dây (kV): I = P / (√3·V·pf).
function lineCurrentA(mw: number, kv: number): number {
  const denom = SQRT3 * kv * 1000 * LINE_PF;
  return denom > 0 ? (mw * 1e6) / denom : 0;
}

export class SwitchyardModel implements ISimModel {
  readonly id = 'thermal-switchyard';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'SY_BUS_A_KV_01', // kV — điện áp thanh cái A
    'SY_BUS_B_KV_01', // kV — điện áp thanh cái B
    'SY_FREQ_01', // Hz — tần số lưới
    'SY_GSU_MW_01', // MW — công suất qua GSU ra trạm
    'SY_LINE1_MW_01', // MW — công suất đường dây 1
    'SY_LINE2_MW_01', // MW — công suất đường dây 2
    'SY_LINE1_CURRENT_01', // A — dòng đường dây 1
    'SY_LINE2_CURRENT_01', // A — dòng đường dây 2
    'SY_MAIN_BREAKER_01', // 0/1 — máy cắt tổng đầu cực đóng
    'SY_LINES_INSERVICE_01', // — số đường dây 500 kV đang vận hành
  ];

  private lineTripped = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.lineTripped = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const exportMw = Math.max(0, ctx.getTag('ELEC_GRID_MW_01')); // MW xuất lưới sau GSU
    const speed = ctx.getTag('TRB_SPEED_01'); // rpm — trục 3000 → 50 Hz
    const freq = speed > 100 ? speed / 60 : 50; // Hz (đồng bộ lưới); mất tốc → giữ 50 tham chiếu
    const breakerClosed = exportMw > 1; // đóng khi có công suất xuất

    // Điện áp thanh cái: danh định, sụt nhẹ theo tải (điều áp GSU/kháng bù).
    const loadFrac = clamp(exportMw / 558, 0, 1.2);
    const busKv = BUS_KV_NOM + 15 - 10 * loadFrac; // ~515 không tải → ~505 đầy tải

    // Phân bổ công suất 2 đường dây: chia đôi; nếu 1 đường trip → đường còn lại gánh toàn bộ.
    const linesInService = this.lineTripped ? 1 : 2;
    const line1Mw = this.lineTripped ? exportMw : exportMw / 2;
    const line2Mw = this.lineTripped ? 0 : exportMw / 2;

    return {
      outputs: [
        { tagId: 'SY_BUS_A_KV_01', value: busKv, quality: 'Good' },
        { tagId: 'SY_BUS_B_KV_01', value: busKv - 1, quality: 'Good' },
        { tagId: 'SY_FREQ_01', value: freq, quality: 'Good' },
        { tagId: 'SY_GSU_MW_01', value: exportMw, quality: 'Good' },
        { tagId: 'SY_LINE1_MW_01', value: line1Mw, quality: 'Good' },
        { tagId: 'SY_LINE2_MW_01', value: line2Mw, quality: 'Good' },
        { tagId: 'SY_LINE1_CURRENT_01', value: lineCurrentA(line1Mw, busKv), quality: 'Good' },
        { tagId: 'SY_LINE2_CURRENT_01', value: lineCurrentA(line2Mw, busKv), quality: 'Good' },
        { tagId: 'SY_MAIN_BREAKER_01', value: breakerClosed ? 1 : 0, quality: 'Good' },
        { tagId: 'SY_LINES_INSERVICE_01', value: linesInService, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { lineTripped: this.lineTripped ? 1 : 0 } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.lineTripped = (snapshot.state.lineTripped ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    // Cắt 1 đường dây 500 kV: đường còn lại gánh toàn tải → dòng tăng (OTS).
    if (m.id === 'line-trip') this.lineTripped = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'line-trip') this.lineTripped = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}
